interface NewsEnv {
  DB: any;
  TELEGRAM_BOT_TOKEN?: string;
  GEMINI_API_KEY?: string;
}

interface NewsArticle {
  title: string;
  url: string;
  description: string;
  source: string;
  publishedAt: Date;
}

interface NewsStory {
  articleNumber: number;
  headline: string;
  explanation: string;
}

const DEFAULT_NEWS_DELIVERY_TIME_IST = "06:15";
const GEMINI_MODEL = "gemini-3.8-flash";
const GOOGLE_NEWS_COOLDOWN_SETTING_KEY = "google_news_rate_limit_until";
const GOOGLE_NEWS_DEFAULT_COOLDOWN_SECONDS = 15 * 60;
const GOOGLE_NEWS_MAX_COOLDOWN_SECONDS = 24 * 60 * 60;

export class GoogleNewsRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Google News is rate-limiting requests. Please try again in about " + retryAfterSeconds + " seconds.");
    this.name = "GoogleNewsRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface CategoryNewsSource {
  categoryId: string;
  topic: string;
  googleNewsUrl: string;
}

const INDIA_STARTUPS_SOURCE: CategoryNewsSource = {
  categoryId: "startup",
  topic: "India Startups",
  googleNewsUrl:
    "https://news.google.com/rss/search?q=india%20startups&hl=en-IN&gl=IN&ceid=IN:en"
};

export async function runIndiaStartupsNewsDelivery(env: NewsEnv, telegramChannelId: string): Promise<void> {
  await runCategoryNewsDelivery(env, INDIA_STARTUPS_SOURCE, telegramChannelId);
}

export async function fetchIndiaStartupsNewsPreview(env: NewsEnv): Promise<Array<{
  title: string;
  source: string;
  publishedAt: string;
}>> {
  const articles = await fetchGoogleNewsArticles(env, INDIA_STARTUPS_SOURCE.googleNewsUrl);
  return articles.slice(0, 20).map(article => ({
    title: article.title,
    source: article.source,
    publishedAt: article.publishedAt.toISOString()
  }));
}

async function runCategoryNewsDelivery(env: NewsEnv, source: CategoryNewsSource, telegramChannelId: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.error(source.topic + " delivery skipped: TELEGRAM_BOT_TOKEN is not configured.");
    return;
  }
  if (!env.GEMINI_API_KEY) {
    console.error(source.topic + " delivery skipped: GEMINI_API_KEY is not configured.");
    return;
  }
  if (!telegramChannelId) {
    console.error(source.topic + " delivery skipped: its Telegram channel ID is missing.");
    return;
  }

  const { date, time } = getIndiaDateAndTime(new Date());
  const deliveryKey = "telegram_news_delivery:" + source.categoryId + ":" + date;
  let priorDelivery: any = null;

  try {
    priorDelivery = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(deliveryKey).first();
  } catch (error) {
    console.error("Could not read " + source.topic + " delivery status from D1:", error);
    return;
  }

  const priorStatus = String(priorDelivery?.value || "");
  if (priorStatus.startsWith("sent:") || priorStatus === "sending") return;
  if (priorStatus.startsWith("failed:")) {
    const failedAt = Number(priorStatus.split(":")[1] || 0);
    if (failedAt && Date.now() - failedAt < 15 * 60 * 1000) return;
  } else if (time !== await getConfiguredDeliveryTime(env)) {
    return;
  }

  try {
    if (!priorStatus) {
      const claim = await env.DB.prepare(
        "INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'sending')"
      ).bind(deliveryKey).run();
      if (Number(claim?.meta?.changes || 0) !== 1) return;
    } else if (priorStatus.startsWith("failed:")) {
      const claim = await env.DB.prepare(
        "UPDATE settings SET value = 'sending' WHERE key = ? AND value = ?"
      ).bind(deliveryKey, priorStatus).run();
      if (Number(claim?.meta?.changes || 0) !== 1) return;
    }
  } catch (error) {
    console.error("Could not claim " + source.topic + " delivery slot:", error);
    return;
  }

  try {
    const articles = await fetchGoogleNewsArticles(env, source.googleNewsUrl);
    const stories = await summarizeArticles(env.GEMINI_API_KEY!, source.topic, articles);
    const message = buildNewsMessage(source.topic, stories, articles);
    const sentIds = await sendNewsMessage(env.TELEGRAM_BOT_TOKEN!, telegramChannelId, message);

    await env.DB.prepare("UPDATE settings SET value = ? WHERE key = ?")
      .bind("sent:" + sentIds.join(","), deliveryKey).run();
    console.log(source.topic + " daily news digest sent. Story count:", stories.length, "Message IDs:", sentIds.join(","));
  } catch (error: any) {
    await env.DB.prepare("UPDATE settings SET value = ? WHERE key = ?")
      .bind("failed:" + Date.now(), deliveryKey).run()
      .catch((dbError: any) => console.error("Could not record failed delivery:", dbError));
    console.error(source.topic + " daily news delivery failed:", error?.message || error);
  }
}

export async function sendIndiaStartupsNewsTest(
  env: NewsEnv,
  telegramChannelId: string
): Promise<{ storyCount: number; messageIds: number[] }> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
  if (!telegramChannelId) throw new Error("The Startup Telegram channel ID is missing.");

  const articles = await fetchGoogleNewsArticles(env, INDIA_STARTUPS_SOURCE.googleNewsUrl);
  const stories = await summarizeArticles(env.GEMINI_API_KEY, INDIA_STARTUPS_SOURCE.topic, articles);
  const message = buildNewsMessage(INDIA_STARTUPS_SOURCE.topic + " — TEST DELIVERY", stories, articles);
  const messageIds = await sendNewsMessage(env.TELEGRAM_BOT_TOKEN, telegramChannelId, message);

  console.log("India Startups test digest sent. Story count:", stories.length, "Message IDs:", messageIds.join(","));
  return { storyCount: stories.length, messageIds };
}

async function getConfiguredDeliveryTime(env: NewsEnv): Promise<string> {
  try {
    const setting = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'news_delivery_time_ist'"
    ).first();
    const value = String(setting?.value || DEFAULT_NEWS_DELIVERY_TIME_IST);
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : DEFAULT_NEWS_DELIVERY_TIME_IST;
  } catch {
    return DEFAULT_NEWS_DELIVERY_TIME_IST;
  }
}

function getIndiaDateAndTime(date: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values: Record<string, string> = {};
  for (const part of parts) values[part.type] = part.value;

  return {
    date: values.year + "-" + values.month + "-" + values.day,
    time: values.hour + ":" + values.minute
  };
}

async function getGoogleNewsCooldownRemaining(env: NewsEnv): Promise<number> {
  const setting = await env.DB.prepare("SELECT value FROM settings WHERE key = ?")
    .bind(GOOGLE_NEWS_COOLDOWN_SETTING_KEY).first();
  const cooldownUntil = Number(setting?.value || 0);
  if (!Number.isFinite(cooldownUntil) || cooldownUntil <= Date.now()) return 0;
  return Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(1, Math.ceil((date - Date.now()) / 1000));
}

async function fetchGoogleNewsArticles(env: NewsEnv, googleNewsUrl: string): Promise<NewsArticle[]> {
  // Respect a shared D1 cooldown so tests and scheduled category deliveries do not
  // repeatedly contact Google while its upstream rate limit is active.
  const cooldown = await getGoogleNewsCooldownRemaining(env);
  if (cooldown > 0) {
    throw new GoogleNewsRateLimitError(cooldown);
  }

  // Read Google's RSS feed directly. Do not request individual Google News article links.
  // Match the working PowerShell request headers and retry temporary network/5xx failures.
  const requestHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9"
  };
  const maxAttempts = 3;
  const retryDelayMs = 2000;
  let response: Response | null = null;
  let lastFetchError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const attemptResponse = await fetch(googleNewsUrl, {
        headers: requestHeaders,
        signal: AbortSignal.timeout(20_000)
      });

      // A 429 is handled by the existing shared D1 cooldown below, without retrying here.
      if (attemptResponse.status === 429) {
        response = attemptResponse;
        break;
      }

      // Retry temporary upstream server errors, including HTTP 503.
      if (attemptResponse.status >= 500 && attemptResponse.status <= 599) {
        await attemptResponse.body?.cancel().catch(() => undefined);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          continue;
        }
      }

      response = attemptResponse;
      break;
    } catch (error) {
      lastFetchError = error;
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  if (!response) {
    throw new Error(
      "Google News RSS request failed after " + maxAttempts + " attempts: " +
      String(lastFetchError instanceof Error ? lastFetchError.message : lastFetchError || "unknown network error")
    );
  }

  if (response.status === 429) {
    const suppliedRetryAfter = parseRetryAfter(response.headers.get("Retry-After"));
    const retryAfterSeconds = Math.min(
      Math.max(suppliedRetryAfter ?? GOOGLE_NEWS_DEFAULT_COOLDOWN_SECONDS, 1),
      GOOGLE_NEWS_MAX_COOLDOWN_SECONDS
    );
    const cooldownUntil = Date.now() + retryAfterSeconds * 1000;

    try {
      await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .bind(GOOGLE_NEWS_COOLDOWN_SETTING_KEY, String(cooldownUntil)).run();
    } catch (error) {
      console.error("Could not save Google News rate-limit cooldown in D1:", error);
    }

    await response.body?.cancel().catch(() => undefined);
    throw new GoogleNewsRateLimitError(retryAfterSeconds);
  }

  if (!response.ok) {
    if (response.status >= 500 && response.status <= 599) {
      const diagnosticHeaders: Record<string, string> = {};
      for (const name of ["content-type", "server", "date", "retry-after", "via", "x-cache", "cf-ray"]) {
        const value = response.headers.get(name);
        if (value) diagnosticHeaders[name] = value.slice(0, 200);
      }

      let bodyPreview = "";
      try {
        bodyPreview = (await response.clone().text())
          .replace(/[\\r\\n\\t]+/g, " ")
          .replace(/[\\u0000-\\u001f\\u007f]/g, "")
          .slice(0, 600);
      } catch {
        bodyPreview = "[response body could not be read]";
      }

      console.error("Google News RSS upstream error diagnostic:", JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        headers: diagnosticHeaders,
        bodyPreview
      }));
    }

    throw new Error("Google News RSS request failed with HTTP " + response.status + ".");
  }

  const xml = await response.text();
  if (!xml || xml.length < 100) {
    throw new Error("Google News returned an empty or incomplete RSS feed.");
  }

  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const articles: NewsArticle[] = [];
  const seenUrls = new Set<string>();

  for (const item of itemBlocks) {
    const title = htmlToText(readGoogleNewsRssField(item, "title"));
    const link = htmlToText(readGoogleNewsRssField(item, "link"));
    const url = safeHttpUrl(link);
    if (!title || title.length < 8 || !url || seenUrls.has(url)) continue;

    const description = htmlToText(readGoogleNewsRssField(item, "description")).slice(0, 1200);
    const sourceName = htmlToText(readGoogleNewsRssField(item, "source")) || "Google News";
    const dateText = htmlToText(readGoogleNewsRssField(item, "pubDate"));
    const parsedDate = dateText ? new Date(dateText) : new Date();
    const publishedAt = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    seenUrls.add(url);
    articles.push({ title, url, description, source: sourceName, publishedAt });
    if (articles.length >= 40) break;
  }

  if (articles.length === 0) {
    throw new Error("Google News RSS feed loaded, but no usable headlines could be extracted.");
  }

  return articles;
}

function readGoogleNewsRssField(item: string, tagName: string): string {
  const match = item.match(new RegExp("<" + tagName + "\\b[^>]*>([\\s\\S]*?)<\\/" + tagName + "\\s*>", "i"));
  return match?.[1] || "";
}

function safeGoogleNewsUrl(value: string): string {
  try {
    const url = new URL(decodeXmlText(value), "https://news.google.com/");
    if (url.protocol !== "https:" || url.hostname !== "news.google.com") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function htmlToText(value: string): string {
  return decodeXmlText(value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;|&#39;/g, "'");
}

function safeHttpUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

async function summarizeArticles(apiKey: string, categoryTopic: string, articles: NewsArticle[]): Promise<NewsStory[]> {
  const articleInput = articles.map((article, index) => {
    const date = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(article.publishedAt);

    return [
      "ARTICLE " + (index + 1),
      "Title: " + article.title,
      "Source: " + article.source,
      "Date: " + date,
      "Description: " + (article.description || "No description supplied.")
    ].join("\n");
  }).join("\n\n");

  const prompt = [
    "Prepare a concise daily " + categoryTopic + " news digest using only the supplied articles.",
    "Select exactly 10 useful, recent and genuinely relevant stories. If fewer than 10 supplied articles are genuinely relevant, do not invent or pad stories; return the relevant stories and the application will reject the digest instead of sending an incomplete test or daily delivery.",
    ...(categoryTopic === "India Startups" ? [
      "Include only Indian startup ecosystem stories: startup companies, founders, venture capital, angel investment, funding rounds, startup launches, acquisitions, incubators, accelerators, or unicorns.",
      "Exclude general business, established-company, stock-market, banking, and economy stories unless they directly concern an Indian startup.",
    ] : []),
    "Put constructive or positive developments first. If there is a genuine significant risk or setback, place it last.",
    "Use very simple English and short explanations. Do not use the words you or your.",
    "Do not invent facts, figures, quotes, dates, or details. Do not repeat a story.",
    "Return only one line per selected story in this exact format:",
    "STORY|ARTICLE_NUMBER|HEADLINE|ONE SHORT EXPLANATION",
    "ARTICLE_NUMBER must be the number of the supplied article. Do not include source links; they will be added separately.",
    "",
    articleInput
  ].join("\n");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL +
      ":generateContent?key=" + encodeURIComponent(apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2600 }
      })
    }
  );

  if (!response.ok) {
    throw new Error("Gemini request failed with HTTP " + response.status + ".");
  }

  const result: any = await response.json();
  const generatedText = (result?.candidates?.[0]?.content?.parts || [])
    .map((part: any) => part.text || "")
    .join("\n")
    .replace(new RegExp(String.fromCharCode(96).repeat(3) + "[a-z]*|" + String.fromCharCode(96).repeat(3), "gi"), "")
    .trim();

  const stories: NewsStory[] = [];
  const seen = new Set<number>();

  for (const line of generatedText.split(/\r?\n/)) {
    const match = line.trim().match(/^STORY\|(\d+)\|([^|]+)\|(.+)$/i);
    if (!match) continue;

    const articleNumber = Number(match[1]);
    if (articleNumber < 1 || articleNumber > articles.length || seen.has(articleNumber)) continue;

    seen.add(articleNumber);
    stories.push({
      articleNumber,
      headline: match[2].trim(),
      explanation: match[3].trim()
    });
    if (stories.length >= 10) break;
  }

  if (stories.length !== 10) {
    throw new Error("Startup digest requires exactly 10 distinct relevant stories; Gemini returned " + stories.length + ". Nothing was sent.");
  }
  return stories;
}

function buildNewsMessage(
  categoryTitle: string,
  stories: NewsStory[],
  articles: NewsArticle[]
): string {
  if (stories.length !== 10) {
    throw new Error("The digest must contain exactly 10 stories. Nothing was sent.");
  }

  const today = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date());

  const prepared = stories.map((story, index) => {
    const article = articles[story.articleNumber - 1];
    if (!article) {
      throw new Error("A source article is missing for story " + (index + 1) + ". Nothing was sent.");
    }
    const sourceDate = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(article.publishedAt);
    return {
      headline: story.headline,
      explanation: story.explanation,
      sourceLine: '<a href="' + escapeTelegramHtml(article.url) + '">Source: ' +
        escapeTelegramHtml(article.source) + " · " + escapeTelegramHtml(sourceDate) + "</a>"
    };
  });

  const render = () => {
    let output = "<b>" + escapeTelegramHtml(categoryTitle) + " — Daily News</b>\\n<code>" +
      escapeTelegramHtml(today) + "</code>\\n\\n";
    for (let index = 0; index < prepared.length; index++) {
      const item = prepared[index];
      output += "<b>" + (index + 1) + ". " + escapeTelegramHtml(item.headline) + "</b>\\n" +
        escapeTelegramHtml(item.explanation) + "\\n" + item.sourceLine + "\\n\\n";
    }
    return output.trim();
  };

  let message = render();

  // Telegram allows up to 4,096 characters after entity parsing. If needed,
  // progressively shorten explanations first, then headlines, while retaining
  // all 10 stories and every original source link/date.
  let explanationIndex = 0;
  while (Array.from(message).length > 4096 && explanationIndex < prepared.length * 40) {
    const item = prepared[explanationIndex % prepared.length];
    const chars = Array.from(item.explanation);
    if (chars.length > 35) {
      item.explanation = chars.slice(0, Math.max(35, chars.length - 12)).join("").replace(/[\\s,;:.!?-]+$/, "") + "…";
    }
    explanationIndex++;
    message = render();
    if (prepared.every(entry => Array.from(entry.explanation).length <= 36)) break;
  }

  let headlineIndex = 0;
  while (Array.from(message).length > 4096 && headlineIndex < prepared.length * 30) {
    const item = prepared[headlineIndex % prepared.length];
    const chars = Array.from(item.headline);
    if (chars.length > 35) {
      item.headline = chars.slice(0, Math.max(35, chars.length - 8)).join("").replace(/[\\s,;:.!?-]+$/, "") + "…";
    }
    headlineIndex++;
    message = render();
    if (prepared.every(entry => Array.from(entry.headline).length <= 36)) break;
  }

  if (Array.from(message).length > 4096) {
    throw new Error("The 10 stories and their source links still exceed Telegram's 4,096-character limit after shortening. Nothing was sent.");
  }

  return message;
}

async function sendNewsMessage(
  botToken: string,
  channelId: string,
  message: string
): Promise<number[]> {
  const sent = await sendTelegramChannelMessage(botToken, channelId, message);
  return [sent.message_id];
}

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendTelegramChannelMessage(
  botToken: string,
  channelId: string,
  text: string
): Promise<{ message_id: number }> {
  const response = await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: channelId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  const result: any = await response.json();
  if (!response.ok || !result?.ok || !result?.result?.message_id) {
    throw new Error("Telegram sendMessage failed: " + (result?.description || response.status));
  }

  return { message_id: Number(result.result.message_id) };
}
