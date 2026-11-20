# MyDigitAsset Google News RSS relay setup

## Why this relay is needed

The Cloudflare Worker receives Google's automated-query 503 page, while the same Startup RSS URL returns valid XML from the user's computer. The Worker therefore needs a separate, trusted execution environment to retrieve Google News RSS.

This small Google Apps Script Web App fetches the RSS feed and returns the original XML to MyDigitAsset. The MyDigitAsset Worker continues to perform article selection, Gemini summarization, and Telegram delivery.

The relay:
- accepts only HTTPS `news.google.com/rss/search` URLs;
- requires a long random shared secret on every POST;
- does not store news feeds or customer information;
- does not call Gemini or Telegram;
- returns the upstream Google News status when the feed cannot be retrieved.

## Part A — Create the Google Apps Script relay

1. Open [Google Apps Script](https://script.google.com/).
2. Create a **new standalone project** named `MyDigitAsset Google News RSS Relay`. Do not replace the existing MyDigitAsset Admin Backend or old News Delivery project.
3. In the editor, open `Code.gs`, remove its starter contents, and paste the complete code from [apps-script/GoogleNewsRssRelay.gs](../apps-script/GoogleNewsRssRelay.gs).
4. Save the project.
5. In the function selector, choose `generateMyDigitAssetRelayToken`, then click **Run**.
6. Approve Google's authorization prompt. This authorizes the script to fetch Google News RSS.
7. Open the execution log and copy the generated token. Keep it private. The script has already saved it in Script Properties under `MYDIGITASSET_RSS_RELAY_TOKEN`.

## Part B — Deploy the relay as a Web App

1. Click **Deploy → New deployment**.
2. Select the gear icon and choose **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone**. The endpoint is protected by the long random token; do not share the token.
5. Click **Deploy** and complete any authorization prompt.
6. Copy the Web App URL ending in `/exec`. Do not use the test `/dev` URL.

You can open the Web App URL in a browser. A small JSON health response confirms that the endpoint is online; it does not expose the secret.

## Part C — Add two Worker settings in Cloudflare

Open the Cloudflare dashboard:

**Workers & Pages → mydigitasset → Settings → Variables and Secrets**

Add these settings to the **Production** environment:

| Name | Type | Value |
|---|---|---|
| `GOOGLE_NEWS_RSS_RELAY_URL` | Text variable | The Apps Script Web App URL ending in `/exec` |
| `GOOGLE_NEWS_RSS_RELAY_TOKEN` | Secret | The token generated in Part A |

Use the exact same token in Apps Script and Cloudflare. Do not paste the token into GitHub, this document, or a public message. Save the settings. Cloudflare may automatically deploy a new Worker version after the settings are saved; if it does not, deploy the latest `main` build from the Cloudflare dashboard.

Keep the existing `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, and other settings unchanged.

## Part D — Test safely

1. Open the MyDigitAsset Administrator Portal.
2. Click **Diagnose Startup RSS + Gemini**.
3. The Google News result should show:
   - `success: true`
   - `source: google-apps-script-relay`
   - a positive `itemCount`
4. The Gemini result now makes one small, 20-second connectivity request. It no longer runs the full 10-story summarization workflow three times.
5. This diagnostic sends **no Telegram message**.

If the relay result reports 401, the token in Cloudflare does not match the token saved in Apps Script. If it reports 503, Google is also rejecting the Apps Script fetch; the relay has not solved the upstream block and we should not pretend otherwise.

## Important

- This setup does not change customer subscriptions, prices, payments, D1 data, Telegram bot tokens, or Telegram channel IDs.
- No Telegram message is sent by the diagnostic.
- The relay only fetches Google News RSS. It does not fetch individual article pages.
- Keep the Apps Script deployment URL and token private.
- If you change the token in Apps Script, update the Cloudflare secret to the same value.
