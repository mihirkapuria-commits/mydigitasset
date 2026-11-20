# MyDigitAsset Google News RSS relay

This folder contains the Google Apps Script code supplied for the MyDigitAsset RSS relay.

## Deploy as a Web App

1. Create or open the Google Apps Script project.
2. Paste the contents of `Code.gs` into the script editor and save.
3. In the function selector, choose `generateMyDigitAssetRelayToken` and run it once. Approve the requested permissions.
4. Open the execution log and copy the generated token. The script saves it automatically in Script Properties under `MYDIGITASSET_RSS_RELAY_TOKEN`.
5. Select **Deploy → New deployment → Web app**.
6. Set **Execute as** to **Me** and **Who has access** to **Anyone**, then deploy.
7. Copy the deployed Web App URL ending in `/exec`.

## Configure the existing Cloudflare Worker

Set the following Worker secrets/variables:

- `GOOGLE_NEWS_RSS_RELAY_URL`: the deployed Apps Script Web App URL ending in `/exec`.
- `GOOGLE_NEWS_RSS_RELAY_TOKEN`: the token printed by `generateMyDigitAssetRelayToken`.

The token value is sensitive. Do not commit it to GitHub or share it in chat.

The existing Worker code already contains support for these two bindings and sends a POST body containing `token` and `feedUrl`.

## Scope

The relay fetches Google News RSS and returns the feed to the Cloudflare Worker. It does not summarize articles, access Telegram, or send Telegram messages. This change does not alter Telegram delivery, category mappings, D1, payments, or subscriptions.

## Operational note

This supplied script makes one upstream request per incoming relay request. It does not implement caching or retries. If Google News continues returning HTTP 503 from Apps Script, we can add retry/caching behavior later after checking the Apps Script execution logs.
