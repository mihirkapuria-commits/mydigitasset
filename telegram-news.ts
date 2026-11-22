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
const GEMINI_PRIMARY_MODEL = "gemini-3.5-flash-lite";
const GEMINI_FALLBACK_MODEL = "gemini-3.8-flash";
const GEMINI_MODELS = [GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL] as const;
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

class InsufficientNewsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientNewsError";
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
  { categoryId: "marketing-advertising", topic: "India Marketing and Advertising", googleNewsUrl: makeGoogleNewsUrl('India advertising OR India adtech OR India "media buying" OR India "media planning" OR India "brand campaign" OR India "digital marketing" OR India "influencer marketing" OR India MarTech OR India "advertising agency" OR India ASCI OR India "media spend"') },
  { categoryId: "real-estate", topic: "India Real Estate", googleNewsUrl: makeGoogleNewsUrl("India real estate housing property infrastructure") },
  { categoryId: "bollywood", topic: "Bollywood and Indian Entertainment", googleNewsUrl: makeGoogleNewsUrl("Bollywood Hindi cinema Indian films entertainment OTT streaming box office") },
  { categoryId: "kids", topic: "India Kids and Education", googleNewsUrl: makeGoogleNewsUrl("India children education schools students learning child policy education technology") },
  { categoryId: "women", topic: "India Women and Leadership", googleNewsUrl: makeGoogleNewsUrl("India women leadership women entrepreneurs women executives board appointments women founders") },
  { categoryId: "politics", topic: "India Politics and Policy", googleNewsUrl: makeGoogleNewsUrl("India politics government policy governance parliament legislation regulation") },
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
    const itemCount = (body.match(/<item\b/gi) || []).length;
    return {
      success: response.ok && itemCount > 0,
      source: response.headers.get("x-mda-rss-source") || "direct-cloudflare",
      relayConfigured: Boolean(env.GOOGLE_NEWS_RSS_RELAY_URL && env.GOOGLE_NEWS_RSS_RELAY_TOKEN),
      status: response.status,
      statusText: response.statusText,
      durationMs: Date.now() - startedAt,
      itemCount,
      headers,
      bodyPreview: body.replace(/[\r\n\t]+/g, " ").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 800)
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
    return {
      success: false,
      model: GEMINI_PRIMARY_MODEL,
      fallbackModel: GEMINI_FALLBACK_MODEL,
      error: "GEMINI_API_KEY is not configured."
    };
  }

  const startedAt = Date.now();
  let lastError = "No Gemini model returned a successful response.";

  for (const model of GEMINI_MODELS) {
    try {
      const prompt = [
        "This is a connectivity test for MyDigitAsset, not a real news request.",
        "Return exactly this text and nothing else: MYDIGITASSET_GEMINI_OK"
      ].join("\n");
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + model +
          ":generateContent?key=" + encodeURIComponent(env.GEMINI_API_KEY),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 40, temperature: 0 }
          }),
          signal: AbortSignal.timeout(15_000)
        }
      );

      const responseText = await response.text();
      if (!response.ok) {
        try {
          const parsed = JSON.parse(responseText);
          lastError = String(parsed?.error?.message || parsed?.error?.status || response.status).slice(0, 500);
        } catch {
          lastError = responseText.slice(0, 300) || ("Gemini returned HTTP " + response.status);
        }
        continue;
      }

      const result = JSON.parse(responseText);
      const generatedText = (result?.candidates?.[0]?.content?.parts || [])
        .map((part: any) => part.text || "").join("\n").trim();
      const success = generatedText.includes("MYDIGITASSET_GEMINI_OK");
      if (success) {
        return {
          success: true,
          model,
          primaryModel: GEMINI_PRIMARY_MODEL,
          fallbackModel: GEMINI_FALLBACK_MODEL,
          durationMs: Date.now() - startedAt,
          responsePreview: generatedText.slice(0, 160),
          finishReason: result?.candidates?.[0]?.finishReason || "not supplied",
          note: "Connectivity test succeeded. The primary model is tried first; fallback is tested only if the primary fails. No news was generated and no Telegram message was sent."
        };
      }
      lastError = "Gemini returned a response, but the expected test text was missing.";
    } catch (error) {
      lastError = String(error instanceof Error ? error.message : error).slice(0, 700);
    }
  }

  return {
    success: false,
    primaryModel: GEMINI_PRIMARY_MODEL,
    fallbackModel: GEMINI_FALLBACK_MODEL,
    durationMs: Date.now() - startedAt,
    error: lastError
  };
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
): Promise<void> {  const channelByCategory = new Map(channels.map(channel => [String(channel.id), channel]));  for (const source of CATEGORY_NEWS_SOURCES) {    const channel = channelByCategory.get(source.categoryId);
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
    // Stop this batch immediately after a shared Google News rate limit.
    // The next scheduled recovery slot will check the saved D1 cooldown before retrying.
    const cooldownRemaining = await getGoogleNewsCooldownRemaining(env);
    if (cooldownRemaining > 0) {
      console.warn("Stopping the remaining category batch; Google News cooldown has " + cooldownRemaining + " seconds left.");
      break;
    }

    // Space out RSS requests to reduce the chance of triggering Google's shared rate limit.
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
}

export async function runCategoryNewsDeliveryBatch(
  env: NewsEnv,
  channels: Array<{ id: string; title: string; telegram_chat_id: string }>,
  categoryIds: string[],
  afterChannelDelivery?: (
    channel: { id: string; title: string; telegram_chat_id: string },
    status: string
  ) => Promise<void>
): Promise<void> {
  const selectedCategoryIds = new Set(categoryIds.map(id => String(id)));
  const channelByCategory = new Map(channels.map(channel => [String(channel.id), channel]));

  for (const source of CATEGORY_NEWS_SOURCES) {
    if (!selectedCategoryIds.has(source.categoryId)) continue;

    const channel = channelByCategory.get(source.categoryId);
    if (!channel || !channel.telegram_chat_id) {
      console.error(source.topic + " delivery skipped: active Telegram channel mapping is missing.");
      continue;
    }

    // Scheduled batches may start after the original 06:15 setting. The batch
    // schedule itself is the authorization to run; daily D1 status prevents duplicates.
    const status = await runCategoryNewsDelivery(
      env,
      source,
      String(channel.telegram_chat_id),
      false,
      true
    );

    if (afterChannelDelivery) {
      try {
        await afterChannelDelivery(channel, status);
      } catch (error) {
        // An advertisement failure must never interrupt the remaining category news deliveries.
        console.error("Post-news channel action failed for " + channel.title + ":", String(error));
      }
    }

    // Stop this batch immediately after a shared Google News rate limit.
    // The next scheduled recovery slot will check the saved D1 cooldown before retrying.
    const cooldownRemaining = await getGoogleNewsCooldownRemaining(env);
    if (cooldownRemaining > 0) {
      console.warn("Stopping the remaining category batch; Google News cooldown has " + cooldownRemaining + " seconds left.");
      break;
    }

    // Space out RSS requests to reduce the chance of triggering Google's shared rate limit.
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
}

export async function runCategoryNewsRecoveryBatch(
  env: NewsEnv,
  channels: Array<{ id: string; title: string; telegram_chat_id: string }>,
  maxCategories = 3,
  afterChannelDelivery?: (
    channel: { id: string; title: string; telegram_chat_id: string },
    status: string
  ) => Promise<void>
): Promise<void> {
  const initialCooldown = await getGoogleNewsCooldownRemaining(env);
  if (initialCooldown > 0) {
    console.log("News recovery batch skipped; Google News cooldown has " + initialCooldown + " seconds left.");
    return;
  }

  const channelByCategory = new Map(channels.map(channel => [String(channel.id), channel]));
  const { date } = getIndiaDateAndTime(new Date());
  const pending: Array<{
    source: CategoryNewsSource;
    channel: { id: string; title: string; telegram_chat_id: string };
    lastAttemptAt: number;
  }> = [];

  for (const source of CATEGORY_NEWS_SOURCES) {
    const channel = channelByCategory.get(source.categoryId);
    if (!channel || !channel.telegram_chat_id) continue;

    const key = "telegram_news_delivery:" + source.categoryId + ":" + date;
    const record = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
    const status = String(record?.value || "");

    // A successful or repeated delivery is final for the day. Never resend it.
    // An in-progress delivery is left alone to avoid racing another invocation.
    if (status.startsWith("sent:") || status.startsWith("repeated:") || status === "sending") continue;

    const lastAttemptAt = status.startsWith("failed:")
      ? Number(status.split(":")[1] || 0)
      : 0;
    pending.push({ source, channel, lastAttemptAt: Number.isFinite(lastAttemptAt) ? lastAttemptAt : 0 });
  }

  // Rotate through failures fairly: after a failed retry its timestamp moves
  // forward, allowing other outstanding categories to be attempted next.
  pending.sort((a, b) => a.lastAttemptAt - b.lastAttemptAt);
  const batchSize = Math.max(1, Math.min(3, Math.floor(maxCategories) || 3));
  const selected = pending.slice(0, batchSize);

  if (selected.length === 0) {
    console.log("News recovery batch: all configured categories are already sent or in progress.");
    return;
  }

  console.log("News recovery batch: attempting " + selected.map(item => item.source.categoryId).join(", "));

  for (const item of selected) {
    const cooldown = await getGoogleNewsCooldownRemaining(env);
    if (cooldown > 0) {
      console.log("Pausing recovery batch; Google News cooldown has " + cooldown + " seconds left.");
      break;
    }

    const status = await runCategoryNewsDelivery(
      env,
      item.source,
      String(item.channel.telegram_chat_id),
      false,
      true
    );

    if (afterChannelDelivery) {
      try {
        await afterChannelDelivery(item.channel, status);
      } catch (error) {
        console.error("Post-news channel action failed for " + item.channel.title + ":", String(error));
      }
    }

    const remainingCooldown = await getGoogleNewsCooldownRemaining(env);
    if (remainingCooldown > 0) {
      console.log("Pausing remaining recovery categories; Google News cooldown has " + remainingCooldown + " seconds left.");
      break;
    }

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
    let articles: NewsArticle[];
    let stories: NewsStory[];

    // Keep the Startup test identical to the production digest: India first,
    // then global startup stories only for any missing slots.
    if (source.categoryId === "startup") {
      const startupDigest = await summarizeStartupDigest(env);
      articles = startupDigest.articles;      stories = startupDigest.stories;
    } else {      const categoryDigest = await summarizeCategoryDigest(env, source);
      articles = categoryDigest.articles;      stories = categoryDigest.stories;
    }

    const message = buildNewsMessage(source.topic + " — TEST DELIVERY", stories, articles, source.categoryId);
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

async function runCategoryNewsDelivery(env: NewsEnv, source: CategoryNewsSource, telegramChannelId: string, manualRetry = false, scheduledRun = false): Promise<string> {
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
  if (priorStatus.startsWith("sent:") || priorStatus.startsWith("repeated:") || priorStatus === "sending") {
    return priorStatus.startsWith("sent:") ? "sent" : priorStatus.startsWith("repeated:") ? "repeated" : "sending";
  }
  if (manualRetry && !priorStatus.startsWith("failed:")) return "not_failed";
  if (priorStatus.startsWith("failed:")) {
    const failedAt = Number(priorStatus.split(":")[1] || 0);
    if (!manualRetry && !scheduledRun && failedAt && Date.now() - failedAt < 15 * 60 * 1000) return "cooldown";
  } else if (!scheduledRun && time !== await getConfiguredDeliveryTime(env)) {
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
    let articles: NewsArticle[];
    let stories: NewsStory[];

    failureStage = "gemini_summarization";
    if (source.categoryId === "startup") {
      const startupDigest = await summarizeStartupDigest(env);
      articles = startupDigest.articles;
      stories = startupDigest.stories;
    } else {
      const categoryDigest = await summarizeCategoryDigest(env, source);
      articles = categoryDigest.articles;
      stories = categoryDigest.stories;
    }

    failureStage = "message_formatting";
    const message = buildNewsMessage(source.topic, stories, articles, source.categoryId);

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
    if (error instanceof InsufficientNewsError) {
      try {
        const repeated = await repeatLastSuccessfulCategoryDigest(
          env,
          source,
          telegramChannelId,
          deliveryKey        );
        if (repeated) return "repeated";
      } catch (repeatError) {        console.error(source.topic + " could not repeat its previous digest:", String(repeatError));
      }
    }
    const failureRecord = "failed:" + Date.now() + ":" + failureStage + ":" + safeMessage;

    await env.DB.prepare("UPDATE settings SET value = ? WHERE key = ?")
      .bind(failureRecord, deliveryKey).run()
      .catch((dbError: any) => console.error("Could not record failed delivery:", dbError));
    console.error(source.topic + " daily news delivery failed at " + failureStage + ":", safeMessage);
    return "failed";
  }
}

async function repeatLastSuccessfulCategoryDigest(
  env: NewsEnv,
  source: CategoryNewsSource,
  telegramChannelId: string,
  currentDeliveryKey: string
): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !telegramChannelId) return false;

  // Look up the most recent digest that was actually delivered to this category.
  // A repeated digest also counts as the latest sent digest, so it can be repeated
  // again on a later day if fresh coverage remains insufficient.
  const previous = await env.DB.prepare(`
    SELECT key, value
    FROM settings
    WHERE key LIKE ?
      AND key <> ?
      AND (value LIKE 'sent:%' OR value LIKE 'repeated:%')
    ORDER BY key DESC
    LIMIT 1
  `).bind(
    "telegram_news_delivery:" + source.categoryId + ":%",
    currentDeliveryKey
  ).first();

  if (!previous?.key || !previous?.value) {
    console.warn(source.topic + ": no previously delivered digest exists to repeat.");
    return false;
  }

  const previousStatus = String(previous.value);
  const messageMatch = previousStatus.match(/^(?:sent|repeated):(\d+)/);
  const previousMessageId = messageMatch ? Number(messageMatch[1]) : NaN;
  if (!Number.isSafeInteger(previousMessageId) || previousMessageId <= 0) {
    console.warn(source.topic + ": the previous delivery record has no valid Telegram message ID.");
    return false;
  }

  // Telegram copies the previously delivered message inside the same category
  // channel, preserving its original digest and clickable source links.
  const response = await fetch(
    "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/copyMessage",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChannelId,
        from_chat_id: telegramChannelId,
        message_id: previousMessageId
      })
    }
  );
  const result: any = await response.json().catch(() => ({}));
  const copiedMessageId = Number(result?.result?.message_id);
  if (!response.ok || result?.ok !== true || !Number.isSafeInteger(copiedMessageId) || copiedMessageId <= 0) {
    throw new Error("Telegram could not copy the previous news digest: " +
      String(result?.description || response.status));
  }

  const previousDateMatch = String(previous.key).match(/:(\d{4}-\d{2}-\d{2})$/);
  const previousDate = previousDateMatch ? previousDateMatch[1] : "unknown";
  await env.DB.prepare("UPDATE settings SET value = ? WHERE key = ?")
    .bind(
      "repeated:" + copiedMessageId + ":" + previousDate + ":" + previousMessageId,
      currentDeliveryKey
    )
    .run();

  // Send the explanation after the copied digest, so it truthfully refers to
  // the repeated message immediately above it.
  try {
    await sendTelegramChannelMessage(
      env.TELEGRAM_BOT_TOKEN,
      telegramChannelId,
      "<b>MYDIGITASSET — NEWS AVAILABILITY</b>\n\nWe could not find 10 relevant new stories for <b>" +
        escapeTelegramHtml(source.topic) +
        "</b> today, even after checking global news. Therefore, the most recently sent digest above has been repeated."
    );
  } catch (noticeError) {
    // The digest itself has been copied and its delivery status saved. Do not
    // copy it again merely because the explanatory follow-up could not be sent.
    console.error(source.topic + ": the repeated digest was sent, but its explanation message failed:", String(noticeError));
  }

  console.log(source.topic + ": repeated the most recently delivered digest because fewer than 10 relevant new stories were available.");
  return true;
}

export async function sendIndiaStartupsNewsTest(
  env: NewsEnv,
  telegramChannelId: string
): Promise<{ storyCount: number; messageIds: number[] }> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
  if (!telegramChannelId) throw new Error("The Startup Telegram channel ID is missing.");

  const { articles, stories } = await summarizeStartupDigest(env);
  const message = buildNewsMessage(INDIA_STARTUPS_SOURCE.topic + " — TEST DELIVERY", stories, articles, "startup");
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
    if (relayResult?.success === true && typeof relayResult.body === "string") {      return new Response(relayResult.body, {
        status: 200,
        headers: {
          "Content-Type": relayResult.contentType || "application/xml; charset=utf-8",          "X-MDA-RSS-Source": "google-apps-script-relay",
          "X-MDA-RSS-Relay-Status": String(relayResult.status || 200)
        }
      });    }
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
        .replace(/[\r\n\t]+/g, " ")
        .replace(/[\u0000-\u001f\u007f]/g, "")
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
          .replace(/[\u0000-\u001f\u007f]/g, "")
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
    articles.push({ title, url, description, source: sourceName, publishedAt });    if (articles.length >= 40) break;
  }

  if (articles.length === 0) {
    throw new Error("Google News RSS feed loaded, but no usable headlines could be extracted.");  }

  return articles;
}
async function fetchMarketingAdvertisingArticles(env: NewsEnv): Promise<NewsArticle[]> {
  // Marketing news is spread across several specialist search terms. A single
  // broad RSS query was not supplying enough distinct, relevant candidates.
  const queries = [
    'India advertising agency OR creative agency OR media agency OR agency account wins OR media mandates OR agency appointments OR brand campaigns',
    'India digital advertising OR adtech OR MarTech OR influencer marketing OR creator marketing OR social media marketing OR programmatic advertising',
    'India advertising market OR ad spend OR media investment OR ASCI OR advertising regulation OR public relations OR sponsorship OR marketing research'
  ];

  const collected: NewsArticle[] = [];
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  for (const query of queries) {
    try {
      const url = makeGoogleNewsUrl(query);
      const batch = await fetchGoogleNewsArticles(env, url);
      for (const article of batch) {
        const normalizedTitle = article.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (seenUrls.has(article.url) || seenTitles.has(normalizedTitle)) continue;
        seenUrls.add(article.url);
        seenTitles.add(normalizedTitle);
        collected.push(article);
      }
    } catch (error) {
      // A shared Google rate-limit cooldown means further RSS requests must stop.
      if (error instanceof GoogleNewsRateLimitError) {
        console.error("Marketing and Advertising: stopping additional RSS searches because Google News is rate-limiting requests.");
        break;
      }
      console.error("Marketing and Advertising: one specialist RSS search failed:", String(error));
    }
  }

  collected.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  const candidates = collected.slice(0, 60);
  if (candidates.length === 0) {
    throw new Error("Marketing and Advertising: no usable articles were found across the specialist Google News searches.");
  }

  console.log("Marketing and Advertising: collected " + candidates.length +
    " distinct candidate articles across " + queries.length + " specialist searches.");
  return candidates;
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

async function summarizeStartupDigest(env: NewsEnv): Promise<{ articles: NewsArticle[]; stories: NewsStory[] }> {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");

  // India remains the first priority. Only expand internationally when the
  // Indian feed does not contain 10 distinct, useful startup stories.
  let indiaArticles: NewsArticle[] = [];
  let indiaStories: NewsStory[] = [];

  try {
    indiaArticles = await fetchGoogleNewsArticles(env, INDIA_STARTUPS_SOURCE.googleNewsUrl);
  } catch (error) {
    // A shared Google rate limit/cooldown must stop all further RSS requests.
    // A non-rate-limit empty/unusable India feed may still use the global fallback.
    if (error instanceof GoogleNewsRateLimitError) throw error;
    console.warn("India Startups: local RSS feed was unusable; trying global fallback:", String(error));
  }

  if (indiaArticles.length > 0) {
    indiaStories = await summarizeArticles(
      env.GEMINI_API_KEY,
      "India Startups",
      indiaArticles,
      10,
      true
    );
  }

  if (indiaStories.length === 10) {
    return { articles: indiaArticles, stories: indiaStories };
  }

  const remaining = 10 - indiaStories.length;
  console.log("India Startups: found " + indiaStories.length +
    " useful Indian stories; searching globally for " + remaining + " more.");

  const globalUrl = "https://news.google.com/rss/search?q=" +
    encodeURIComponent("global startups founders venture capital funding startup launches acquisitions") +
    "&hl=en-US&gl=US&ceid=US:en";
  const fetchedGlobalArticles = await fetchGoogleNewsArticles(env, globalUrl);

  // Remove duplicate URLs and identical normalized headlines across both feeds.
  const seenUrls = new Set(indiaArticles.map(article => article.url));
  const seenTitles = new Set(indiaArticles.map(article => article.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()));
  const globalArticles = fetchedGlobalArticles.filter(article => {
    const normalizedTitle = article.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seenUrls.has(article.url) || seenTitles.has(normalizedTitle)) return false;
    seenUrls.add(article.url);
    seenTitles.add(normalizedTitle);
    return true;
  });

  if (globalArticles.length === 0) {
    throw new InsufficientNewsError("Only " + indiaStories.length +
      " useful Indian startup stories were found, and no additional distinct global startup stories were available. Nothing was sent.");
  }

  const globalStories = await summarizeArticles(
    env.GEMINI_API_KEY,
    "Global Startups",
    globalArticles,
    remaining,
    true
  );

  if (globalStories.length !== remaining) {
    throw new InsufficientNewsError("India Startups: found " + indiaStories.length +
      " relevant Indian stories and " + globalStories.length +
      " relevant global stories; exactly 10 are required. Nothing was sent.");
  }

  const combinedArticles = indiaArticles.concat(globalArticles);
  const combinedStories = indiaStories.concat(globalStories.map(story => ({
    ...story,
    headline: "[GLOBAL] " + story.headline,
    articleNumber: story.articleNumber + indiaArticles.length
  })));

  if (combinedStories.length !== 10) {
    throw new InsufficientNewsError("Startup digest could not reach exactly 10 distinct stories after global expansion. Nothing was sent.");
  }

  return { articles: combinedArticles, stories: combinedStories };
}

async function summarizeCategoryDigest(
  env: NewsEnv,
  source: CategoryNewsSource
): Promise<{ articles: NewsArticle[]; stories: NewsStory[] }> {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");

  // India/category-specific reporting always has first priority.
  // The existing source query is fetched once; global news is requested only
  // when Gemini finds fewer than 10 genuinely relevant local stories.
  let localArticles: NewsArticle[] = [];
  let localStories: NewsStory[] = [];

  try {    localArticles = await fetchGoogleNewsArticles(env, source.googleNewsUrl);
  } catch (error) {
    // Do not issue another Google request while its shared cooldown is active.
    // For an empty/unusable category feed, continue to the one global fallback.
    if (error instanceof GoogleNewsRateLimitError) throw error;
    console.warn(source.topic + ": local RSS feed was unusable; trying global fallback:", String(error));  }

  if (localArticles.length > 0) {
    localStories = await summarizeArticles(
      env.GEMINI_API_KEY,
      source.topic,      localArticles,
      10,
      true
    );
  }

  if (localStories.length === 10) {
    return { articles: localArticles, stories: localStories };
  }

  const remaining = 10 - localStories.length;
  const globalTopic = "Global " + source.topic.replace(/^India\s+/i, "").trim();
  const globalQuery = "global " + source.topic.replace(/^India\s+/i, "").trim() + " latest news";
  const globalUrl = "https://news.google.com/rss/search?q=" +
    encodeURIComponent(globalQuery) + "&hl=en-US&gl=US&ceid=US:en";

  console.log(source.topic + ": found " + localStories.length +
    " relevant India/category stories; searching globally for " + remaining + " more.");

  const fetchedGlobalArticles = await fetchGoogleNewsArticles(env, globalUrl);
  const seenUrls = new Set(localArticles.map(article => article.url));
  const seenTitles = new Set(localArticles.map(article =>
    article.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  ));
  const globalArticles = fetchedGlobalArticles.filter(article => {
    const normalizedTitle = article.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seenUrls.has(article.url) || seenTitles.has(normalizedTitle)) return false;
    seenUrls.add(article.url);
    seenTitles.add(normalizedTitle);
    return true;
  });

  if (globalArticles.length === 0) {
    throw new InsufficientNewsError(source.topic + ": only " + localStories.length +
      " relevant local stories were found and no distinct global fallback articles were available. Nothing was sent.");
  }

  const globalStories = await summarizeArticles(
    env.GEMINI_API_KEY,
    globalTopic,
    globalArticles,
    remaining,
    true
  );

  if (globalStories.length !== remaining) {
    throw new InsufficientNewsError(source.topic + ": found " + localStories.length +
      " relevant local stories and " + globalStories.length +
      " relevant global stories; exactly 10 are required. Nothing was sent.");
  }

  const combinedArticles = localArticles.concat(globalArticles);
  const combinedStories = localStories.concat(globalStories.map(story => ({
    ...story,
    headline: "[GLOBAL] " + story.headline,
    articleNumber: story.articleNumber + localArticles.length
  })));

  if (combinedStories.length !== 10) {
    throw new InsufficientNewsError(source.topic + ": global fallback did not produce exactly 10 distinct stories. Nothing was sent.");
  }

  return { articles: combinedArticles, stories: combinedStories };
}

function getCategoryEditorialGuidance(categoryTopic: string): string[] {
  const isGlobal = categoryTopic.startsWith("Global ");
  const market = isGlobal ? "outside India" : "in India";
  const topic = categoryTopic.replace(/^Global\s+/i, "").toLowerCase();
  const rules: Record<string, string[]> = {
    "startups": [
      "Select only startup-ecosystem developments: startup companies, founders, venture-capital and angel funding, funding rounds, launches, acquisitions, incubators, accelerators, scale-ups and unicorns.",
      "Exclude established-company results, general corporate news, stock-market movements, banking and macroeconomic stories unless the central development directly concerns a startup."
    ],
    "banking": [
      "Focus on banks, RBI actions, monetary and banking regulation, NBFCs, lending, deposits, credit cards, UPI and digital payments, fintech products, payment networks, insurance distribution and financial inclusion.",
      "For India editions, include international-company stories only when the article establishes a clear Indian-market impact. For global fallback editions, cover major banking and fintech developments in other markets.",
      "Exclude ordinary stock-price movements, general startup funding, unrelated corporate results and broad economy stories unless banking or fintech is the main subject."
    ],
    "consumer": [
      "Focus on consumer demand and behaviour, FMCG, packaged foods, beverages, personal care, household products, retail, e-commerce, consumer brands, distribution, pricing, market share, product safety and consumer regulation.",
      "Include brand or company results only when they reveal a meaningful consumer-market development. Exclude advertising campaigns unless the advertising industry itself is the main subject."
    ],
    "economy": [
      "Focus on the overall economy and business environment in the relevant market: GDP, growth, inflation, interest rates, public finances, taxation, trade, exports and imports, industrial activity, investment, major corporate developments and business confidence.",
      "Select broad economy or cross-industry business developments. Prefer specialist channels for stories whose main subject is banking, stock markets, startups, energy, real estate, advertising or another dedicated category.",
      "Include international developments only when the article explains a direct and material effect on India's economy or businesses."
    ],
    "energy": [
      "Focus on energy supply and demand, electricity, power generation and distribution, solar, wind, hydro, green hydrogen, batteries and storage, grids, oil, gas, coal, fuel prices, energy projects and energy policy.",
      "For India editions, include international developments only when they have a clear Indian project, market, supply, price or policy connection. For global fallback editions, cover major energy developments in other markets. Exclude climate stories without a meaningful energy angle."
    ],
    "hr": [
      "Focus on employment, hiring, layoffs, job creation, wages, workplace conditions, labour laws, industrial relations, workforce skills, HR technology, talent management, employee benefits and leadership appointments with a clear HR or employment angle.",
      "Exclude generic job advertisements, individual career advice and company news that does not materially affect employment or workplace practices."
    ],
    "cybersecurity": [
      "Focus on India's IT and technology sector, software and IT services, artificial intelligence, enterprise technology, cloud computing, cybersecurity, data protection, data centres, telecom technology and major technology policy.",
      "For India editions, include global technology developments only when the article identifies a direct Indian business, user, security, investment or regulatory impact. For global fallback editions, select significant technology and cybersecurity developments from other markets.",
      "Exclude routine gadget launches, product reviews, generic technology speculation and AI stories without a substantive Indian technology or cybersecurity angle."
    ],
    "manufacturing": [
      "Focus on manufacturing, industrial production, factories, capital expenditure, supply chains, industrial policy, PLI schemes, industrial automation, engineering, auto manufacturers, vehicle sales and production, EVs, auto components and mobility.",
      "For India editions, include global developments only when they affect Indian manufacturing, auto production, suppliers, investment or policy. For global fallback editions, cover major manufacturing and automotive developments in other markets. Exclude ordinary vehicle reviews and celebrity endorsements."
    ],
    "marketing": [
      "This category is strictly about the marketing, advertising, media and brand-communications industry " + market + ". Select stories only when marketing or advertising is the main subject, not a passing mention.",
      "Cover advertising, creative and media agencies, new business wins, account gains, media mandates, agency appointments and leadership changes; campaign launches; digital, social-media and video advertising; media planning and buying; advertising spend; adtech and MarTech; influencer and creator marketing; brand strategy; public relations; sponsorships; marketing research and measurement; media-industry developments; and advertising regulation.",
      "Exclude general company results, product launches, retail and FMCG news, e-commerce sales, startup funding, celebrity news, job listings and general business stories unless the central development is specifically about advertising, marketing, media, an agency, adtech or MarTech.",
      "Do not treat an article as relevant merely because it mentions a brand, promotion, sales, customers or social media."
    ],
    "real estate": [
      "Focus on residential and commercial property, housing, rentals, land, developers, real-estate transactions, office and retail property, warehousing, REITs, property finance, construction, urban development and major infrastructure projects.",
      "For India editions, include global developments only when they have a clear Indian property, infrastructure, investment or regulatory connection. For global fallback editions, cover significant property and infrastructure developments in other markets. Exclude generic construction or stock-market stories without a real-estate angle."
    ],
    "bollywood": [
      "Focus on " + (isGlobal ? "major global film and entertainment industries, including internationally relevant developments in Indian cinema" : "the Indian entertainment industry, especially Hindi cinema") + ": film production, releases, box office, studios, filmmakers, actors' professional work, streaming and OTT business, music, distribution, exhibition and material industry changes.",
      "Exclude rumours, unverified gossip, private-life coverage, routine celebrity sightings and promotional stories with no meaningful entertainment-industry development. Include other Indian-language entertainment only when it is a significant Indian industry story."
    ],
    "kids": [
      "Focus on children and education " + (isGlobal ? "in major global markets" : "in India") + ": schools, school education, curriculum, examinations, learning outcomes, teachers, child-focused learning, early childhood, education policy, scholarships, school safety and education technology used by children.",
      "Include higher-education stories only when they have a clear wider education-policy or student-learning significance. Exclude generic adult career advice and unrelated health or parenting lifestyle content."
    ],
    "women": [
      "Focus on women in leadership and public life " + (isGlobal ? "across major global markets" : "in India") + ": women founders and entrepreneurs, business leaders, senior appointments, board representation, leadership achievements, workplace inclusion, women-led organisations and policies that materially affect women's participation and advancement.",
      "Prioritise credible achievements, decisions and measurable developments. Exclude generic lifestyle, fashion, celebrity or health stories unless they directly concern leadership, opportunity, safety or women's participation in society and the economy."
    ],
    "politics": [
      "Focus on politics and public policy in the relevant market: governments and legislatures, elections, political parties, major public decisions, legislation, regulation, governance, public administration and policy implementation.",
      "Explain the policy or governance consequence where the supplied article supports it. Exclude routine political comments, unverified allegations, partisan opinion and political gossip without a substantive public-interest development."
    ],
    "stock market": [
      "Focus on financial markets: NSE and BSE for India editions, or major international exchanges for global fallback editions; indices, listed companies, share-price movements with a clear catalyst, market trends, corporate earnings, IPOs, public issues, market participants and securities-market regulation.",
      "Explain the actual market development rather than offering investment advice or predicting returns. Exclude generic personal-finance advice, unlisted startup funding and broad economy stories unless the direct stock-market impact is central."
    ]
  };

  let selected: string[] | undefined;
  if (topic.includes("startup")) selected = rules["startups"];
  else if (topic.includes("banking") || topic.includes("fintech")) selected = rules["banking"];
  else if (topic.includes("consumer") || topic.includes("fmcg")) selected = rules["consumer"];
  else if (topic.includes("economy") || topic.includes("business")) selected = rules["economy"];
  else if (topic.includes("energy") || topic.includes("renewable")) selected = rules["energy"];
  else if (topic.includes("hr") || topic.includes("employment")) selected = rules["hr"];
  else if (topic.includes("cybersecurity") || topic.includes("technology") || topic.includes(" it ") || topic.startsWith("it ")) selected = rules["cybersecurity"];
  else if (topic.includes("manufacturing") || topic.includes("auto")) selected = rules["manufacturing"];
  else if (topic.includes("marketing") || topic.includes("advertising")) selected = rules["marketing"];
  else if (topic.includes("real estate")) selected = rules["real estate"];
  else if (topic.includes("bollywood") || topic.includes("entertainment")) selected = rules["bollywood"];
  else if (topic.includes("kids") || topic.includes("education")) selected = rules["kids"];
  else if (topic.includes("women")) selected = rules["women"];
  else if (topic.includes("politics") || topic.includes("governance") || topic.includes("policy")) selected = rules["politics"];
  else if (topic.includes("stock market")) selected = rules["stock market"];

  const scope = isGlobal
    ? "These are global fallback stories from outside India. Keep the selected stories genuinely relevant to the named category and do not present them as Indian developments."
    : "These are India-first stories. Prefer developments in India and include an international company only when the supplied article establishes a direct and meaningful Indian connection.";
  return [
    scope,
    ...(selected || [
      "Select only stories whose main subject directly matches this category. Reject passing mentions and unrelated general news."
    ]),
    "Apply the same category boundary to every story; do not fill the digest with adjacent topics merely to reach the requested count."
  ];
}

async function summarizeArticles(
  apiKey: string,
  categoryTopic: string,
  articles: NewsArticle[],
  targetCount = 10,
  allowFewer = false
): Promise<NewsStory[]> {
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
    "Select " + targetCount + " useful, recent and genuinely relevant stories. " +
      (allowFewer        ? "If fewer than " + targetCount + " supplied articles are genuinely relevant, return only the relevant stories; do not invent or pad."
        : "Do not invent or pad stories. Return exactly " + targetCount + " distinct stories."),
    ...getCategoryEditorialGuidance(categoryTopic),
    "Put constructive or positive developments first. If there is a genuine significant risk or setback, place it last.",
    "Use very simple English. Each story must have a brief, useful understanding of about 15–25 words. Do not use the words you or your.",
    "CRITICAL: The explanation is NOT a second headline. Never repeat, restate, paraphrase, or merely rearrange the headline in the explanation.",
    "The explanation must add NEW information from the supplied article: explain what happened in practical terms, give relevant context, or state why the development matters and who or what it affects.",    "Do not begin the explanation by repeating the headline or its opening phrase. Avoid copying headline wording except for essential names, organisations, places, or technical terms.",
    "If the article description does not provide enough information for a meaningful explanation, say only what can be supported; never guess or add outside facts.",
    "Example: Headline: RBI keeps the repo rate unchanged. Explanation: Borrowing costs are likely to remain steady for now, giving banks and borrowers no immediate rate change.",
    "Do not invent facts, figures, quotes, dates, or details. Do not repeat a story.",
    "Return only one line per selected story in this exact format:",
    "STORY|ARTICLE_NUMBER|HEADLINE|ONE SHORT UNDERSTANDING (ADDS CONTEXT; NOT A HEADLINE REWRITE)",
    "ARTICLE_NUMBER must be the number of the supplied article. Do not include source links; they will be added separately.",
    "",
    articleInput
  ].join("\n");

  let response: Response | null = null;
  let lastGeminiError: unknown = null;

  // Try the economical high-throughput model first, then the stronger Flash fallback.
  // Each model gets at most two attempts; permanent client errors are not retried.
  for (const model of GEMINI_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const attemptResponse = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" + model +
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

        if ((attemptResponse.status === 429 || attemptResponse.status >= 500) && attempt < 2) {
          await attemptResponse.body?.cancel().catch(() => undefined);
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue;
        }

        response = attemptResponse;
        break;
      } catch (error) {
        lastGeminiError = error;
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    if (response?.ok) break;
    // Try the fallback for rate limits, server errors, or network timeouts.
    if (response && response.status < 500 && response.status !== 429) break;
    response = null;
  }

  if (!response) {
    throw new Error(
      "Gemini primary and fallback models failed: " +
      String(lastGeminiError instanceof Error ? lastGeminiError.message : lastGeminiError || "temporary API failure")
    );
  }

  if (!response.ok) {
    let apiError = "";
    try {
      const errorBody: any = await response.json();
      apiError = String(errorBody?.error?.message || errorBody?.error?.status || "").slice(0, 500);
    } catch {
      apiError = "";    }
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
    if (stories.length >= targetCount) break;
  }

  if (!allowFewer && stories.length !== targetCount) {
    throw new Error("Category digest requires exactly " + targetCount + " distinct relevant stories; Gemini returned " + stories.length + ". Nothing was sent.");
  }
  return stories;
}

function telegramVisibleTextLength(htmlMessage: string): number {
  // Telegram applies the 4,096-character limit to visible text after HTML
  // entities are parsed. Link destinations in href attributes are not visible
  // message text and must not be included in this count.
  const visibleText = htmlMessage
    .replace(/<[^>]*>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
  return Array.from(visibleText).length;
}

function buildNewsMessage(
  categoryTitle: string,
  stories: NewsStory[],
  articles: NewsArticle[],
  categoryId = ""
): string {
  const channelBranding: Record<string, { heading: string; subtitle: string }> = {
    "banking-fintech": { heading: "BANKING & FINTECH", subtitle: "INDIA · BANKING & FINTECH INTELLIGENCE" },
    "consumer-fmcg": { heading: "CONSUMER & FMCG", subtitle: "INDIA · CONSUMER & FMCG INTELLIGENCE" },
    "economy-business": { heading: "ECONOMY & BUSINESS", subtitle: "INDIA · ECONOMY & BUSINESS INTELLIGENCE" },
    "energy-renewal": { heading: "ENERGY & RENEWABLES", subtitle: "INDIA · ENERGY & RENEWABLES INTELLIGENCE" },
    "hr-employment": { heading: "HR & EMPLOYMENT", subtitle: "INDIA · HR & EMPLOYMENT INTELLIGENCE" },
    "it-ai-cybersecurity": { heading: "IT, AI & CYBERSECURITY", subtitle: "INDIA · TECHNOLOGY INTELLIGENCE" },
    "manufacturing-auto": { heading: "MANUFACTURING & AUTO", subtitle: "INDIA · MANUFACTURING & AUTO INTELLIGENCE" },
    "marketing-advertising": { heading: "MARKETING & ADVERTISING", subtitle: "INDIA · MARKETING & ADVERTISING INTELLIGENCE" },
    "real-estate": { heading: "REAL ESTATE & INFRASTRUCTURE", subtitle: "INDIA · REAL ESTATE & INFRASTRUCTURE INTELLIGENCE" },
    "startup": { heading: "STARTUP", subtitle: "INDIA · STARTUP INTELLIGENCE" },
    "bollywood": { heading: "BOLLYWOOD & ENTERTAINMENT", subtitle: "INDIA · ENTERTAINMENT INTELLIGENCE" },
    "kids": { heading: "KIDS & PARENTING", subtitle: "INDIA · KIDS & PARENTING INTELLIGENCE" },
    "women": { heading: "WOMEN IN FOCUS", subtitle: "INDIA · WOMEN IN FOCUS INTELLIGENCE" },
    "politics": { heading: "POLITICS & GOVERNANCE", subtitle: "INDIA · POLITICS & GOVERNANCE INTELLIGENCE" },
    "stock-market": { heading: "STOCK MARKET & D-STREET", subtitle: "INDIA · STOCK MARKET INTELLIGENCE" }
  };
  const branding = channelBranding[categoryId] || {
    heading: categoryTitle.toUpperCase(),
    subtitle: "INDIA · DAILY NEWS INTELLIGENCE"
  };
  if (stories.length !== 10) {
    throw new Error("The digest must contain exactly 10 stories. Nothing was sent.");
  }

  const today = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date());

  // Tag every global fallback story and explain why global coverage is included.
  const globalStoryCount = stories.filter(story => /^\[GLOBAL\]/i.test(story.headline)).length;
  const globalNotice = globalStoryCount === 10
    ? "Relevant Indian news was not found for this category today; all 10 stories are from global sources."
    : globalStoryCount > 0
      ? "Relevant Indian news was not found for " + globalStoryCount +
        " story slot(s) today; global news are sent for those slots."
      : "";

  const prepared = stories.map((story, index) => {
    const article = articles[story.articleNumber - 1];
    if (!article) {
      throw new Error("A source article is missing for story " + (index + 1) + ". Nothing was sent.");
    }
    return {
      headline: story.headline,
      explanation: story.explanation,
      sourceLine: '<a href="' + escapeTelegramHtml(article.url) + '">' +
        escapeTelegramHtml(article.source) + "</a>"
    };
  });

  const render = () => {
    let output = "<b>MYDIGITASSET</b>\n<b>" +
      escapeTelegramHtml(branding.heading) + "</b>\n<i>" +
      escapeTelegramHtml(branding.subtitle) + "</i>\n<code>" +
      escapeTelegramHtml(today) + "</code>\n\n" +
      (globalNotice ? "<i>" + escapeTelegramHtml(globalNotice) + "</i>\n\n" : "");
    for (let index = 0; index < prepared.length; index++) {
      const item = prepared[index];
      output += "<b>" + (index + 1) + ". " + escapeTelegramHtml(item.headline) + "</b>\n" +        escapeTelegramHtml(item.explanation) + "\n" + item.sourceLine + "\n\n";
    }
    return output.trim();
  };

  let message = render();

  // Telegram allows up to 4,096 characters after entity parsing. If needed,  // progressively shorten explanations first, then headlines, while retaining
  // all 10 stories and every original clickable source name.
  let explanationIndex = 0;
  while (telegramVisibleTextLength(message) > 4096 && explanationIndex < prepared.length * 40) {
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
  while (telegramVisibleTextLength(message) > 4096 && headlineIndex < prepared.length * 30) {
    const item = prepared[headlineIndex % prepared.length];
    const chars = Array.from(item.headline);
    if (chars.length > 35) {
      item.headline = chars.slice(0, Math.max(35, chars.length - 8)).join("").replace(/[\s,;:.!?-]+$/, "") + "…";
    }
    headlineIndex++;
    message = render();
    if (prepared.every(entry => Array.from(entry.headline).length <= 36)) break;
  }

  if (telegramVisibleTextLength(message) > 4096) {
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
    const messageIds = await sendNewsMessage(env.TELEGRAM_BOT_TOKEN, channelId, testMessage);    return { storyCount: 0, messageIds };
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