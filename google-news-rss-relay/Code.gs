/**
 * MyDigitAsset Google News RSS relay.
 *
 * Deploy this project as a Google Apps Script Web App.
 * Store the shared secret in Script Properties as RELAY_TOKEN.
 *
 * Expected POST JSON:
 *   { "token": "<shared-secret>", "feedUrl": "https://news.google.com/rss/..." }
 *
 * Success JSON:
 *   { "success": true, "status": 200, "contentType": "...", "body": "<rss>..." }
 */

const ALLOWED_HOST = "news.google.com";
const CACHE_TTL_SECONDS = 180;
const MAX_CACHEABLE_BODY_CHARS = 95000;
const MAX_FEED_URL_LENGTH = 2000;
const FETCH_ATTEMPTS = 3;

function doPost(e) {
  try {
    const request = parseRequest_(e);
    const expectedToken = PropertiesService.getScriptProperties().getProperty("RELAY_TOKEN");

    if (!expectedToken) {
      return jsonOutput_({
        success: false,
        status: 503,
        error: "Relay is not configured: Script Property RELAY_TOKEN is missing."
      });
    }

    if (!request.token || !constantTimeEquals_(request.token, expectedToken)) {
      return jsonOutput_({ success: false, status: 401, error: "Unauthorized relay request." });
    }

    const feedUrl = validateFeedUrl_(request.feedUrl);
    if (!feedUrl) {
      return jsonOutput_({
        success: false,
        status: 400,
        error: "feedUrl must be an HTTPS Google News RSS URL."
      });
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = "rss_" + sha256_(feedUrl);
    const cached = cache.get(cacheKey);
    if (cached) {
      return jsonOutput_({
        success: true,
        status: 200,
        contentType: "application/rss+xml; charset=utf-8",
        body: cached,
        cached: true
      });
    }

    const result = fetchFeedWithRetry_(feedUrl);
    if (result.success && result.body.length <= MAX_CACHEABLE_BODY_CHARS) {
      cache.put(cacheKey, result.body, CACHE_TTL_SECONDS);
    }

    return jsonOutput_(result);
  } catch (error) {
    console.error("MyDigitAsset RSS relay error: " + String(error && error.stack || error));
    return jsonOutput_({
      success: false,
      status: 500,
      error: String(error && error.message || error).slice(0, 600)
    });
  }
}

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("A JSON POST body is required.");
  }
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {
    throw new Error("Request body must be valid JSON.");
  }
  return {
    token: String(body.token || ""),
    feedUrl: String(body.feedUrl || "")
  };
}

function validateFeedUrl_(value) {
  if (!value || value.length > MAX_FEED_URL_LENGTH) return "";
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== ALLOWED_HOST ||
      !parsed.pathname.startsWith("/rss/")
    ) {
      return "";
    }
    return parsed.toString();
  } catch (_) {
    return "";
  }
}

function fetchFeedWithRetry_(feedUrl) {
  let lastStatus = 502;
  let lastBody = "";
  let lastContentType = "application/xml; charset=utf-8";

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const response = UrlFetchApp.fetch(feedUrl, {
        method: "get",
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          "Accept-Language": "en-IN,en;q=0.9"
        }
      });

      lastStatus = response.getResponseCode();
      lastBody = response.getContentText() || "";
      const headers = response.getHeaders();
      lastContentType = String(headers["Content-Type"] || headers["content-type"] || lastContentType);

      if (lastStatus >= 200 && lastStatus < 300 && looksLikeRss_(lastBody)) {
        return {
          success: true,
          status: lastStatus,
          contentType: lastContentType,
          body: lastBody,
          cached: false
        };
      }

      if (lastStatus >= 400 && lastStatus < 500 && lastStatus !== 429) {
        return {
          success: false,
          status: lastStatus,
          error: "Google News RSS returned HTTP " + lastStatus + ": " + lastBody.slice(0, 500)
        };
      }

      if (attempt < FETCH_ATTEMPTS) {
        Utilities.sleep(1000 * Math.pow(2, attempt - 1));
      }
    } catch (error) {
      lastBody = String(error && error.message || error);
      if (attempt < FETCH_ATTEMPTS) {
        Utilities.sleep(1000 * Math.pow(2, attempt - 1));
      }
    }
  }

  return {
    success: false,
    status: lastStatus >= 400 && lastStatus <= 599 ? lastStatus : 502,
    error: ("Google News RSS fetch failed after " + FETCH_ATTEMPTS +
      " attempts. " + lastBody).slice(0, 700)
  };
}

function looksLikeRss_(body) {
  return /<rss\b/i.test(body) && /<item\b/i.test(body);
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function sha256_(value) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, "");
}

function jsonOutput_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
