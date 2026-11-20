interface NewsEnv {
  DB: any;
  TELEGRAM_BOT_TOKEN?: string;
  GEMINI_API_KEY?: string;
  GOOGLE_NEWS_RSS_RELAY_URL?: string;
  GOOGLE_NEWS_RSS_RELAY_TOKEN?: string;
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

  constructor(retryAfterSeconds: number, diagnosticMessage = "") {
    super((diagnosticMessage ? diagnosticMessage + " " : "") +
      "Pausing further RSS requests for about " + retryAfterSeconds + " seconds.");
    this.name = "GoogleNewsRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface CategoryNewsSource {
  categoryId: string;
  topic: string;
  googleNewsUrl: string;
}

const CATEGORY_NEWS_SOURCES: CategoryNewsSource[] = [
  { categoryId: "banking-fintech", topic: "India Banking and Fintech", googleNewsUrl: makeGoogleNewsUrl("India banking fintech digital payments RBI banks") },
  { categoryId: "consumer-fmcg", topic: "India Consumer and FMCG", googleNewsUrl: makeGoogleNewsUrl("India consumer goods FMCG retail brands") },
  { categoryId: "economy-business", topic: "India Economy and Business", googleNewsUrl: makeGoogleNewsUrl("India economy business industry trade") },
  { categoryId: "energy-renewal", topic: "India Energy and Renewables", googleNewsUrl: makeGoogleNewsUrl("India energy oil natural gas renewable power") },
  { categoryId: "hr-employment", topic: "India HR and Employment", googleNewsUrl: makeGoogleNewsUrl("India employment jobs human resources workplace") },
  { categoryId: "it-ai-cybersecurity", topic: "India IT AI and Cybersecurity", googleNewsUrl: makeGoogleNewsUrl("India information technology artificial intelligence cybersecurity") },
  { categoryId: "manufacturing-auto", topic: "India Manufacturing and Auto", googleNewsUrl: makeGoogleNewsUrl("India manufacturing automobile auto industry") },
  { categoryId: "marketing-advertising", topic: "India Marketing and Advertising", googleNewsUrl: makeGoogleNewsUrl("India marketing advertising digital marketing brands") },
  { categoryId: "real-estate", topic: "India Real Estate", googleNewsUrl: makeGoogleNewsUrl("India real estate housing property infrastructure") },
  { categoryId: "bollywood", topic: "Bollywood", googleNewsUrl: makeGoogleNewsUrl("Bollywood Hindi cinema Indian films entertainment") },
  { categoryId: "kids", topic: "Kids and Education", googleNewsUrl: makeGoogleNewsUrl("India children education schools learning kids") },
  { categoryId: "women", topic: "Women in India", googleNewsUrl: makeGoogleNewsUrl("India women business education health achievements") },
  { categoryId: "politics", topic: "India Politics and Governance", googleNewsUrl: makeGoogleNewsUrl("India politics government policy governance parliament") },
  { categoryId: "stock-market", topic: "India Stock Market", googleNewsUrl: makeGoogleNewsUrl("India stock market NSE BSE shares markets") },
  { categoryId: "startup", topic: "India Startups", googleNewsUrl: makeGoogleNewsUrl("India startups founders venture capital funding") }
];

function makeGoogleNewsUrl(query: string): string {
  return "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) + "&hl=en-IN&gl=IN&ceid=IN:en";
}

const INDIA_STARTUPS_SOURCE = CATEGORY_NEWS_SOURCES.find(source => source.categoryId === "startup")!;


export async function diagnoseStartupGoogleNews(env: NewsEnv): Promise<Record<string, unknown>> {
  const startedAt = Date.now();
  try {
    const response = await fetchGoogleNewsSource(env, INDIA_STARTUPS_SOURCE.googleNewsUrl);
    const body = await response.text();
    const headers: Record<string, string> = {};
    for (const name of ["content-type", "server", "date", "retry-after", "via", "x-cache", "cf-ray", "x-mda-rss-source"]) {
      const value = response.headers.get(name);
      if (value) headers[name] = value.slice(0, 200);
    }
    const itemCount = (body.match(/<item\\b/gi) || []).length;
    return {
      success: response.ok && itemCount > 0,
      source: response.headers.get("x-mda-rss-source") || "direct-cloudflare",
      relayConfigured: Boolean(env.GOOGLE_NEWS_RSS_RELAY_URL && env.GOOGLE_NEWS_RSS_RELAY_TOKEN),
      status: response.status,
      statusText: response.statusText,
      durationMs: Date.now() - startedAt,
      itemCount,
      headers,
      bodyPreview: body.replace(/[\\r\\n\\t]+/g, " ").replace(/[\\u0000-\\u001f\\u007f]/g, "").slice(0, 800)
    };
  } catch (error) {
    return {
      success: false,
      source: env.GOOGLE_NEWS_RSS_RELAY_URL ? "google-apps-script-relay" : "direct-cloudflare",
      relayConfigured: Boolean(env.GOOGLE_NEWS_RSS_RELAY_URL && env.GOOGLE_NEWS_RSS_RELAY_TOKEN),
      durationMs: Date.now() - startedAt,
      error: String(error instanceof Error ? error.message : error).slice(0, 700)
    };
  }
}

export async function diagnoseStartupGemini(env: NewsEnv): Promise<Record<string, unknown>> {
  if (!env.GEMINI_API_KEY) {
    return { success: false, model: GEMINI_MODEL, error: "GEMINI_API_KEY is not configured." };
  }
  const startedAt = Date.now();
  try {
    const prompt = [
      "This is a connectivity test for MyDigitAsset, not a real news request.",
      "Return exactly this text and nothing else: MYDIGITASSET_GEMINI_OK"
    ].join("\\n");
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL +
        ":generateContent?key=" + encodeURIComponent(env.GEMINI_API_KEY),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 40, temperature: 0 }
        }),
        signal: AbortSignal.timeout(20_000)
      }
    );
    const responseText = await response.text();
    if (!response.ok) {
      let providerMessage = "";
      try {
        const parsed = JSON.parse(responseText);
        providerMessage = String(parsed?.error?.message || parsed?.error?.status || "").slice(0, 500);
      } catch {
        providerMessage = responseText.slice(0, 300);
      }
      return {
        success: false,
        model: GEMINI_MODEL,
        status: response.status,
        statusText: response.statusText,
        durationMs: Date.now() - startedAt,
        error: providerMessage || "Gemini returned an unsuccessful HTTP response."
      };
    }
    const result = JSON.parse(responseText);
    const generatedText = (result?.candidates?.[0]?.content?.parts || [])
      .map((part: any) => part.text || "").join("\\n").trim();
    return {
      success: generatedText.includes("MYDIGITASSET_GEMINI_OK"),
      model: GEMINI_MODEL,
      status: response.status,
      durationMs: Date.now() - startedAt,
      responsePreview: generatedText.slice(0, 160),
      finishReason: result?.candidates?.[0]?.finishReason || "not supplied",
      note: "One small synthetic connectivity request only. No news was generated and no Telegram message was sent."
    };
  } catch (error) {
    return {
      success: false,
      model: GEMINI_MODEL,
      durationMs: Date.now() - startedAt,
      error: String(error instanceof Error ? error.message : error).slice(0, 700)
    };
  }
}

export async function runIndiaStartupsNewsDelivery(env: NewsEnv, telegramChannelId: string): Promise<void> {
  await runCategoryNewsDelivery(env, INDIA_STARTUPS_SOURCE, telegramChannelId);
}

export async function runAllCategoryNewsDeliveries(
  env: NewsEnv,
  channels: Array<{ id: string; title: string; telegram_chat_id: string }>,
  afterChannelDelivery?: (
    channel: { id: string; title: string; telegram_chat_id: string },
    status: string
  ) => Promise<void>
): Promise<void> {
  const channelByCategory = new Map(channels.map(channel => [String(channel.id), channel]));
  for (const source of CATEGORY_NEWS_SOURCES) {
    const channel = channelByCategory.get(source.categoryId);
    if (!channel || !channel.telegram_chat_id) {
      console.error(source.topic + " delivery skipped: active Telegram channel mapping is missing.");
      continue;
    }
    const status = await runCategoryNewsDelivery(env, source, String(channel.telegram_chat_id));
    if (afterChannelDelivery) {
      try {
        await afterChannelDelivery(channel, status);
      } catch (error) {
        // An advertisement failure must never interrupt the remaining category news deliveries.
        console.error("Post-news channel action failed for " + channel.title + ":", String(error));
      }
    }
    // Space out RSS requests to reduce the chance of triggering Google's shared rate limit.
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
}

export async function sendCategoryNewsTest(
  env: NewsEnv,
  categoryId: string,
  channel: { id: string; title: string; telegram_chat_id: string } | null
): Promise<{
  category: string;
  title: string;
  status: "sent" | "failed";
  storyCount?: number;
  messageIds?: number[];
  error?: string;
}> {
  const source = CATEGORY_NEWS_SOURCES.find(item => item.categoryId === categoryId);
  if (!source) {
    return { category: categoryId, title: categoryId, status: "failed", error: "Unknown news category." };
  }
  if (!channel?.telegram_chat_id) {
    return { category: categoryId, title: source.topic, status: "failed", error: "Active Telegram channel mapping is missing." };
  }

  try {
    if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
    const articles = await fetchGoogleNewsArticles(env, source.googleNewsUrl);
    const stories = await summarizeArticles(env.GEMINI_API_KEY, source.topic, articles);
    const message = buildNewsMessage(source.topic + " — TEST DELIVERY", stories, articles);
    const messageIds = await sendNewsMessage(env.TELEGRAM_BOT_TOKEN, String(channel.telegram_chat_id), message);
    return {
      category: source.categoryId,
      title: channel.title || source.topic,
      status: "sent",
      storyCount: stories.length,
      messageIds
    };
  } catch (error: any) {
    return {
      category: source.categoryId,
      title: channel.title || source.topic,
      status: "failed",
      error: String(error?.message || error || "Unknown error")
        .replace(env.TELEGRAM_BOT_TOKEN || "__NO_TELEGRAM_TOKEN__", "[REDACTED]")
        .replace(/\s+/g, " ")
        .slice(0, 250)
    };
  }
}

export async function sendAllCategoryNewsTests(
  env: NewsEnv,
  channels: Array<{ id: string; title: string; telegram_chat_id: string }>,
  onChannelResult?: (result: {
    category: string;
    title: string;
    status: "sent" | "failed";
    storyCount?: number;
    messageIds?: number[];
    error?: string;
  }) => Promise<void>
): Promise<Array<{
  category: string;
  title: string;
  status: "sent" | "failed";
  storyCount?: number;
  messageIds?: number[];
  error?: string;
}>> {
  const channelByCategory = new Map(channels.map(channel => [String(channel.id), channel]));
  const results = [];

  for (const source of CATEGORY_NEWS_SOURCES) {
    const result = await sendCategoryNewsTest(env, source.categoryId, channelByCategory.get(source.categoryId) || null);
    results.push(result);
    if (onChannelResult) {
      try { await onChannelResult(result); }
      catch (error) { console.error("Could not save all-channel news test progress:", String(error)); }
    }
    await new Promise(resolve => setTimeout(resolve, 1200));
  }

  return results;
}

export async function retryBankingFintechNewsDelivery(env: NewsEnv): Promise<{ status: string; message: string }> {
  const channel = await env.DB.prepare(
    "SELECT telegram_chat_id FROM managed_categories WHERE id = 'banking-fintech' AND active = 1 LIMIT 1"
  ).first();
  if (!channel?.telegram_chat_id) {
    throw new Error("The Banking and Fintech Telegram channel is not configured or active.");
  }

  const { date } = getIndiaDateAndTime(new Date());
  const key = "telegram_news_delivery:banking-fintech:" + date;
  const record = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  const current = String(record?.value || "");
  if (!current.startsWith("failed:")) {
    return {
      status: current.startsWith("sent:") ? "sent" : current === "sending" ? "sending" : "not_failed",
      message: "Retry not started: today's Banking and Fintech delivery is not marked failed."
    };
  }

  const status = await runCategoryNewsDelivery(env, CATEGORY_NEWS_SOURCES.find(source => source.categoryId === "banking-fintech")!, String(channel.telegram_chat_id), true);
  return {
    status,
    message: status === "sent"
      ? "Banking and Fintech daily news was successfully delivered."
      : status === "failed"
        ? "The retry failed. The category remains marked failed."
        : "The retry was not started because the delivery status changed."
  };
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

async function runCategoryNewsDelivery(env: NewsEnv, source: CategoryNewsSource, telegramChannelId: string, manualRetry = false): Promise<string> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.error(source.topic + " delivery skipped: TELEGRAM_BOT_TOKEN is not configured.");
    return "skipped";
  }
  if (!env.GEMINI_API_KEY) {
    console.error(source.topic + " delivery skipped: GEMINI_API_KEY is not configured.");
    return "skipped";
  }
  if (!telegramChannelId) {
    console.error(source.topic + " delivery skipped: its Telegram channel ID is missing.");
    return "skipped";
  }

  const { date, time } = getIndiaDateAndTime(new Date());
  const deliveryKey = "telegram_news_delivery:" + source.categoryId + ":" + date;
  let priorDelivery: any = null;

  try {
    priorDelivery = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(deliveryKey).first();
  } catch (error) {
    console.error("Could not read " + source.topic + " delivery status from D1:", error);
    return "skipped";
  }

  const priorStatus = String(priorDelivery?.value || "");
  if (priorStatus.startsWith("sent:") || priorStatus === "sending") return priorStatus.startsWith("sent:") ? "sent" : "sending";
  if (manualRetry && !priorStatus.startsWith("failed:")) return "not_failed";
  if (priorStatus.startsWith("failed:")) {
    const failedAt = Number(priorStatus.split(":")[1] || 0);
    if (!manualRetry && failedAt && Date.now() - failedAt < 15 * 60 * 1000) return "cooldown";
  } else if (time !== await getConfiguredDeliveryTime(env)) {
    return "not_due";
  }

  try {
    if (!priorStatus) {
      const claim = await env.DB.prepare(
        "INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'sending')"
      ).bind(deliveryKey).run();
      if (Number(claim?.meta?.changes || 0) !== 1) return "claimed_elsewhere";
    } else if (priorStatus.startsWith("failed:")) {
      const claim = await env.DB.prepare(
        "UPDATE settings SET value = 'sending' WHERE key = ? AND value = ?"
      ).bind(deliveryKey, priorStatus).run();
      if (Number(claim?.meta?.changes || 0) !== 1) return "claimed_elsewhere";
    }
  } catch (error) {
    console.error("Could not claim " + source.topic + " delivery slot:", error);
    return "skipped";
  }

  let failureStage = "google_news_rss";
  try {
    const articles = await fetchGoogleNewsArticles(env, source.googleNewsUrl);

    failureStage = "gemini_summarization";
    const stories = await summarizeArticles(env.GEMINI_API_KEY!, source.topic, articles);

    failureStage = "message_formatting";
    const message = buildNewsMessage(source.topic, stories, articles);

    failureStage = "telegram_send";
    const sentIds = await sendNewsMessage(env.TELEGRAM_BOT_TOKEN!, telegramChannelId, message);

    await env.DB.prepare("UPDATE settings SET value = ? WHERE key = ?")
      .bind("sent:" + sentIds.join(","), deliveryKey).run();
    console.log(source.topic + " daily news digest sent. Story count:", stories.length, "Message IDs:", sentIds.join(","));
    return "sent";
  } catch (error: any) {
    const rawMessage = String(error?.message || error || "Unknown error");
    const safeMessage = rawMessage
      .replace(env.TELEGRAM_BOT_TOKEN || "__NO_TELEGRAM_TOKEN__", "[REDACTED]")
      .replace(/\s+/g, " ")
      .slice(0, 300);
    const failureRecord = "failed:" + Date.now() + ":" + failureStage + ":" + safeMessage;

    await env.DB.prepare("UPDATE settings SET value = ? WHERE key = ?")
      .bind(failureRecord, deliveryKey).run()
      .catch((dbError: any) => console.error("Could not record failed delivery:", dbError));
    console.error(source.topic + " daily news delivery failed at " + failureStage + ":", safeMessage);
    return "failed";
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

async function fetchGoogleNewsSource(env: NewsEnv, googleNewsUrl: string): Promise<Response> {
  const relayUrl = String(env.GOOGLE_NEWS_RSS_RELAY_URL || "").trim();
  const relayToken = String(env.GOOGLE_NEWS_RSS_RELAY_TOKEN || "");
  if (relayUrl || relayToken) {
    if (!relayUrl || !relayToken) {
      throw new Error("Google News RSS relay is only partially configured. Set both GOOGLE_NEWS_RSS_RELAY_URL and GOOGLE_NEWS_RSS_RELAY_TOKEN.");
    }
    const parsedRelayUrl = new URL(relayUrl);
    if (parsedRelayUrl.protocol !== "https:" || !["script.google.com", "script.googleusercontent.com"].includes(parsedRelayUrl.hostname)) {
      throw new Error("Google News RSS relay URL must be an HTTPS Google Apps Script web-app URL.");
    }
    const relayResponse = await fetch(relayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: relayToken, feedUrl: googleNewsUrl }),
      signal: AbortSignal.timeout(25_000),
      redirect: "follow"
    });
    const relayText = await relayResponse.text();
    let relayResult: any = {};
    try {
      relayResult = JSON.parse(relayText);
    } catch {
      return new Response("Google News RSS relay returned an unreadable response: " + relayText.slice(0, 500), {
        status: relayResponse.ok ? 502 : relayResponse.status,
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-MDA-RSS-Source": "google-apps-script-relay" }
      });
    }
    if (relayResult?.success === true && typeof relayResult.body === "string") {
      return new Response(relayResult.body, {
        status: 200,
        headers: {
          "Content-Type": relayResult.contentType || "application/xml; charset=utf-8",
          "X-MDA-RSS-Source": "google-apps-script-relay",
          "X-MDA-RSS-Relay-Status": String(relayResult.status || 200)
        }
      });
    }
    const upstreamStatus = Number(relayResult?.status || relayResponse.status || 502);
    const safeStatus = upstreamStatus >= 400 && upstreamStatus <= 599 ? upstreamStatus : 502;
    return new Response(String(relayResult?.error || "Google News RSS relay could not retrieve the feed.").slice(0, 800), {
      status: safeStatus,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-MDA-RSS-Source": "google-apps-script-relay"
      }
    });
  }

  return fetch(googleNewsUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-IN,en;q=0.9"
    },
    signal: AbortSignal.timeout(20_000),
    cf: { cacheTtl: 0, cacheEverything: false }
  });
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
  const maxAttempts = 3;
  const retryDelayMs = [2000, 5000];
  let response: Response | null = null;
  let lastFetchError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const attemptResponse = await fetchGoogleNewsSource(env, googleNewsUrl);

      // A 429 is handled by the existing shared D1 cooldown below, without retrying here.
      if (attemptResponse.status === 429) {
        response = attemptResponse;
        break;
      }

      // Retry temporary upstream server errors, including HTTP 503.
      if (attemptResponse.status >= 500 && attemptResponse.status <= 599) {
        if (attempt < maxAttempts) {
          await attemptResponse.body?.cancel().catch(() => undefined);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs[attempt - 1]));
          continue;
        }
      }

      response = attemptResponse;
      break;
    } catch (error) {
      lastFetchError = error;
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs[attempt - 1]));
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
    const retryAfterHeader = response.headers.get("Retry-After");
    const suppliedRetryAfter = parseRetryAfter(retryAfterHeader);
    const retryAfterSeconds = Math.min(
      Math.max(suppliedRetryAfter ?? GOOGLE_NEWS_DEFAULT_COOLDOWN_SECONDS, 1),
      GOOGLE_NEWS_MAX_COOLDOWN_SECONDS
    );
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

    const cooldownUntil = Date.now() + retryAfterSeconds * 1000;

    try {
      await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .bind(GOOGLE_NEWS_COOLDOWN_SETTING_KEY, String(cooldownUntil)).run();
    } catch (error) {
      console.error("Could not save Google News rate-limit cooldown in D1:", error);
    }

    await response.body?.cancel().catch(() => undefined);
    const retryDetail = "Google News returned HTTP 429 (Too Many Requests)." +
      (retryAfterHeader ? " Retry-After header: " + retryAfterHeader.slice(0, 200) + "." : " No Retry-After header was supplied.");
    throw new GoogleNewsRateLimitError(retryAfterSeconds, retryDetail);
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
          .replace(/[\\r\n\\t]+/g, " ")
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

      // A 5xx response is shared upstream trouble, not a category-specific failure.
      // Pause later category requests so the same Google endpoint is not hammered 15 times.
      const suppliedRetryAfter = parseRetryAfter(response.headers.get("Retry-After"));
      const cooldownSeconds = Math.min(
        Math.max(suppliedRetryAfter ?? 300, 60),
        GOOGLE_NEWS_MAX_COOLDOWN_SECONDS
      );
      const cooldownUntil = Date.now() + cooldownSeconds * 1000;
      try {
        await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
          .bind(GOOGLE_NEWS_COOLDOWN_SETTING_KEY, String(cooldownUntil)).run();
      } catch (error) {
        console.error("Could not save Google News 5xx cooldown in D1:", error);
      }
      await response.body?.cancel().catch(() => undefined);
      const retryAfterHeader = response.headers.get("Retry-After");
      const upstreamDetail = "Google News RSS returned HTTP " + response.status +
        (response.statusText ? " (" + response.statusText + ")" : "") + "." +
        (retryAfterHeader ? " Retry-After header: " + retryAfterHeader.slice(0, 120) + "." : "");
      throw new GoogleNewsRateLimitError(cooldownSeconds, upstreamDetail);
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
  const match = item.match(
    new RegExp("<" + tagName + "\\b[^>]*>([\\s\\S]*?)<\\/" + tagName + "\\s*>", "i")
  );
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

  let response: Response | null = null;
  let lastGeminiError: unknown = null;
  const geminiRetryDelays = [2000, 5000];

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const attemptResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL +
          ":generateContent?key=" + encodeURIComponent(apiKey),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2600 }
          }),
          signal: AbortSignal.timeout(25_000)
        }
      );

      if ((attemptResponse.status === 429 || (attemptResponse.status >= 500 && attemptResponse.status <= 599)) && attempt < 3) {
        await attemptResponse.body?.cancel().catch(() => undefined);
        await new Promise(resolve => setTimeout(resolve, geminiRetryDelays[attempt - 1]));
        continue;
      }

      response = attemptResponse;
      break;
    } catch (error) {
      lastGeminiError = error;
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, geminiRetryDelays[attempt - 1]));
      }
    }
  }

  if (!response) {
    throw new Error(
      "Gemini request failed after 3 attempts: " +
      String(lastGeminiError instanceof Error ? lastGeminiError.message : lastGeminiError || "unknown network error")
    );
  }

  if (!response.ok) {
    let apiError = "";
    try {
      const errorBody: any = await response.json();
      apiError = String(errorBody?.error?.message || errorBody?.error?.status || "").slice(0, 500);
    } catch {
      apiError = "";
    }
    throw new Error(
      "Gemini request failed with HTTP " + response.status +
      (response.statusText ? " (" + response.statusText + ")" : "") +
      (apiError ? ": " + apiError : ".")
    );
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
    throw new Error("Category digest requires exactly 10 distinct relevant stories; Gemini returned " + stories.length + ". Nothing was sent.");
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
    let output = "<b>" + escapeTelegramHtml(categoryTitle) + " — Daily News</b>\n<code>" +
      escapeTelegramHtml(today) + "</code>\n\n";
    for (let index = 0; index < prepared.length; index++) {
      const item = prepared[index];
      output += "<b>" + (index + 1) + ". " + escapeTelegramHtml(item.headline) + "</b>\n" +
        escapeTelegramHtml(item.explanation) + "\n" + item.sourceLine + "\n\n";
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
      item.explanation = chars.slice(0, Math.max(35, chars.length - 12)).join("").replace(/[\s,;:.!?-]+$/, "") + "…";
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
      item.headline = chars.slice(0, Math.max(35, chars.length - 8)).join("").replace(/[\s,;:.!?-]+$/, "") + "…";
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

export async function sendTelegramConnectionTest(
  env: NewsEnv,
  channelId: string,
  categoryId: string
): Promise<{ storyCount: number; messageIds: number[] }> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  if (!channelId) throw new Error("Telegram channel ID is missing.");

  // This is deliberately a Telegram-only test: no Google News RSS or Gemini calls.
  const testMessage =
    "<b>MYDIGITASSET — TELEGRAM CONNECTION TEST</b>\n" +
    "Channel: " + escapeTelegramHtml(categoryId) + "\n" +
    "Time: " + new Date().toISOString() + "\n\n" +
    "This is a one-time delivery test. No action is required.";

  try {
    const messageIds = await sendNewsMessage(env.TELEGRAM_BOT_TOKEN, channelId, testMessage);
    return { storyCount: 0, messageIds };
  } catch (error: any) {
    const safeMessage = String(error?.message || error)
      .replace(env.TELEGRAM_BOT_TOKEN, "[REDACTED]")
      .replace(/\s+/g, " ")
      .slice(0, 300);
    throw new Error("telegram_send: " + safeMessage);
  }
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
