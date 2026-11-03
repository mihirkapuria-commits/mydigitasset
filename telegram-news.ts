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

interface CategoryNewsSource {
  categoryId: string;
  topic: string;
  googleNewsUrl: string;
}

const INDIA_STARTUPS_SOURCE: CategoryNewsSource = {
  categoryId: "india-startups",
  topic: "India Startups",
  googleNewsUrl:
    "https://news.google.com/search?q=(India%20startup%20OR%20Indian%20startup)%20(funding%20OR%20investment%20OR%20business%20OR%20launch)&hl=en-IN&gl=IN&ceid=IN:en"
};

export async function runIndiaStartupsNewsDelivery(env: NewsEnv): Promise<void> {
  await runCategoryNewsDelivery(env, INDIA_STARTUPS_SOURCE);
}

async function runCategoryNewsDelivery(env: NewsEnv, source: CategoryNewsSource): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.error(source.topic + " delivery skipped: TELEGRAM_BOT_TOKEN is not configured.");
    return;
  }
  if (!env.GEMINI_API_KEY) {
    console.error(source.topic + " delivery skipped: GEMINI_API_KEY is not configured.");
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
    const category = await getActiveTelegramCategory(env, source.categoryId);
    const articles = await fetchGoogleNewsArticles(source.googleNewsUrl);
    const stories = await summarizeArticles(env.GEMINI_API_KEY!, source.topic, articles);
    const message = buildNewsMessage(category.title || source.topic, stories, articles);
    const sent = await sendTelegramChannelMessage(env.TELEGRAM_BOT_TOKEN!, String(category.telegram_channel_id), message);

    await env.DB.prepare("UPDATE settings SET value = ? WHERE key = ?")
      .bind("sent:" + String(sent.message_id), deliveryKey).run();
    console.log(source.topic + " daily news digest sent. Message ID:", sent.message_id);
  } catch (error: any) {
    await env.DB.prepare("UPDATE settings SET value = ? WHERE key = ?")
      .bind("failed:" + Date.now(), deliveryKey).run()
      .catch((dbError: any) => console.error("Could not record failed delivery:", dbError));
    console.error(source.topic + " daily news delivery failed:", error?.message || error);
  }
}

async function getActiveTelegramCategory(env: NewsEnv, categoryId: string): Promise<any> {
  const category = await env.DB.prepare(
    "SELECT id, title, telegram_channel_id FROM categories WHERE id = ? AND active = 1"
  ).bind(categoryId).first();
  if (!category || !category.telegram_channel_id) {
    throw new Error("The active category or its Telegram channel ID is missing in D1: " + categoryId);
  }
  return category;
}

export async function sendIndiaStartupsNewsTest(env: NewsEnv): Promise<number> {
  return sendCategoryNewsTest(env, INDIA_STARTUPS_SOURCE);
}

async function sendCategoryNewsTest(env: NewsEnv, source: CategoryNewsSource): Promise<number> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");

  const category = await getActiveTelegramCategory(env, source.categoryId);
  const articles = await fetchGoogleNewsArticles(source.googleNewsUrl);
  const stories = await summarizeArticles(env.GEMINI_API_KEY, source.topic, articles);
  const message = buildNewsMessage(category.title || source.topic, stories, articles);
  const result = await sendTelegramChannelMessage(env.TELEGRAM_BOT_TOKEN, String(category.telegram_channel_id), message);

  console.log(source.topic + " test digest sent. Message ID:", result.message_id);
  return result.message_id;
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

async function fetchGoogleNewsArticles(googleNewsUrl: string): Promise<NewsArticle[]> {
  // Fetch the Google News search webpage directly. No RSS feed or other news provider is used.
  const response = await fetch(googleNewsUrl, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; MyDigitAsset-NewsBot/1.0)"
    }
  });

  if (!response.ok) {
    throw new Error("Google News webpage request failed with HTTP " + response.status + ".");
  }

  const html = await response.text();
  if (!html || html.length < 500) {
    throw new Error("Google News returned an empty or incomplete search webpage.");
  }

  const articles: NewsArticle[] = [];
  const seenUrls = new Set<string>();
  const articleBlocks = html.match(/<article\b[\s\S]*?<\/article>/gi) || [];

  // Extract Google News article cards first.
  for (const block of articleBlocks) {
    const linkPattern = /<a\b([^>]*)href=["']([^"']*(?:read|articles)\/[^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
    let linkMatch: RegExpExecArray | null;

    while ((linkMatch = linkPattern.exec(block)) !== null) {
      const attributes = linkMatch[1] + " " + linkMatch[3];
      const title = htmlToText(linkMatch[4]) ||
        htmlToText((attributes.match(/aria-label=["']([^"']+)["']/i) || [])[1] || "");
      const url = safeGoogleNewsUrl(linkMatch[2]);
      if (!title || title.length < 12 || !url || seenUrls.has(url)) continue;

      const timeMatch = block.match(/<time\b[^>]*datetime=["']([^"']+)["']/i);
      const parsedDate = timeMatch ? new Date(timeMatch[1]) : new Date();
      const publishedAt = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

      seenUrls.add(url);
      articles.push({ title, url, description: "", source: "Google News", publishedAt });
      break;
    }
    if (articles.length >= 10) break;
  }

  // Google may change its card wrapper. Still restrict extraction to Google News story URLs.
  if (articles.length === 0) {
    const linkPattern = /<a\b([^>]*)href=["']([^"']*(?:read|articles)\/[^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkPattern.exec(html)) !== null && articles.length < 10) {
      const attributes = match[1] + " " + match[3];
      const title = htmlToText(match[4]) ||
        htmlToText((attributes.match(/aria-label=["']([^"']+)["']/i) || [])[1] || "");
      const url = safeGoogleNewsUrl(match[2]);
      if (!title || title.length < 12 || !url || seenUrls.has(url)) continue;

      seenUrls.add(url);
      articles.push({ title, url, description: "", source: "Google News", publishedAt: new Date() });
    }
  }

  if (articles.length === 0) {
    throw new Error("Google News webpage loaded, but no article headlines could be extracted. Google may have changed its page structure or restricted automated access.");
  }

  return articles;
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
    "Select up to 5 useful, recent and genuinely relevant stories.",
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
        generationConfig: { temperature: 0.2, maxOutputTokens: 1200 }
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
    if (stories.length >= 5) break;
  }

  return stories;
}

function buildNewsMessage(
  categoryTitle: string,
  stories: NewsStory[],
  articles: NewsArticle[]
): string {
  const today = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date());

  const lines = [
    "<b>" + escapeTelegramHtml(categoryTitle) + " — Daily News</b>",
    "<code>" + escapeTelegramHtml(today) + "</code>",
    ""
  ];

  for (let index = 0; index < stories.length; index++) {
    const story = stories[index];
    const article = articles[story.articleNumber - 1];
    const sourceDate = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(article.publishedAt);

    lines.push(
      "<b>" + (index + 1) + ". " + escapeTelegramHtml(story.headline) + "</b>",
      escapeTelegramHtml(story.explanation),
      '<a href="' + escapeTelegramHtml(article.url) + '">Source: ' +
        escapeTelegramHtml(article.source) + " · " + escapeTelegramHtml(sourceDate) + "</a>",
      ""
    );
  }

  return lines.join("\n").trim();
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
