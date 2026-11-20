/**
 * MyDigitAsset Google News RSS relay.
 *
 * Deploy as a Google Apps Script Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Protect the public endpoint with the secret stored in Script Properties:
 *   MYDIGITASSET_RSS_RELAY_TOKEN
 *
 * This relay only accepts HTTPS Google News RSS search URLs. It does not
 * summarize articles, access Telegram, or send messages.
 */

const MYDIGITASSET_RELAY_TOKEN_PROPERTY = "MYDIGITASSET_RSS_RELAY_TOKEN";

function doGet() {
  return relayJson_({
    success: true,
    service: "MyDigitAsset Google News RSS Relay",
    message: "Relay is online. Use an authenticated POST request to fetch a feed."
  });
}

/**
 * Run once from the Apps Script editor.
 * The generated token is saved in Script Properties and printed in the
 * execution log so it can be copied into Cloudflare Worker secrets.
 */
function generateMyDigitAssetRelayToken() {
  const token = Utilities.getUuid().replace(/-/g, "") +
    Utilities.getUuid().replace(/-/g, "") +
    Utilities.getUuid().replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty(
    MYDIGITASSET_RELAY_TOKEN_PROPERTY,
    token
  );
  Logger.log("Copy this token into the Cloudflare secret GOOGLE_NEWS_RSS_RELAY_TOKEN:");
  Logger.log(token);
  return token;
}

function doPost(e) {
  try {
    const payload = JSON.parse(e && e.postData && e.postData.contents || "{}");
    const expectedToken = PropertiesService.getScriptProperties()
      .getProperty(MYDIGITASSET_RELAY_TOKEN_PROPERTY);

    if (!expectedToken || !constantTimeEquals_(String(payload.token || ""), expectedToken)) {
      return relayJson_({
        success: false,
        status: 401,
        error: "Relay authentication failed. Check the configured relay token."
      });
    }

    const feedUrl = validateGoogleNewsFeedUrl_(String(payload.feedUrl || ""));
    if (!feedUrl) {
      return relayJson_({
        success: false,
        status: 400,
        error: "Only HTTPS news.google.com/rss/search feed URLs are accepted."
      });
    }

    const response = UrlFetchApp.fetch(feedUrl, {
      method: "get",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MyDigitAssetNewsRelay/1.0)",
        "Accept": "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9"
      },
      followRedirects: true,
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    const body = response.getContentText("UTF-8");
    const headers = response.getAllHeaders ? response.getAllHeaders() : {};
    const contentType = String(
      headers["Content-Type"] || headers["content-type"] || "application/xml; charset=utf-8"
    );

    if (status !== 200 || !/<rss\b/i.test(body) || !/<item\b/i.test(body)) {
      return relayJson_({
        success: false,
        status: status >= 400 && status <= 599 ? status : 502,
        upstreamStatus: status,
        contentType: contentType,
        error: "Google News did not return a usable RSS feed. Response preview: " +
          body.replace(/[\r\n\t]+/g, " ").slice(0, 500)
      });
    }

    return relayJson_({
      success: true,
      status: status,
      contentType: contentType,
      itemCount: (body.match(/<item\b/gi) || []).length,
      body: body
    });
  } catch (error) {
    return relayJson_({
      success: false,
      status: 500,
      error: String(error && error.message || error).slice(0, 500)
    });
  }
}

function validateGoogleNewsFeedUrl_(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "news.google.com" ||
      url.pathname !== "/rss/search" ||
      !url.searchParams.get("q") ||
      url.searchParams.get("q").length > 300 ||
      url.username ||
      url.password
    ) {
      return "";
    }
    return url.toString();
  } catch (error) {
    return "";
  }
}

function constantTimeEquals_(provided, expected) {
  let difference = provided.length ^ expected.length;
  const length = Math.max(provided.length, expected.length);
  for (let i = 0; i < length; i++) {
    difference |= (provided.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return difference === 0;
}

function relayJson_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
