# MyDigitAsset Google News RSS relay

This Google Apps Script is the RSS collection endpoint already supported by the MyDigitAsset Worker in `telegram-news.ts`.

It moves Google News RSS fetching out of the Cloudflare Worker runtime. The Worker sends a POST request containing `token` and `feedUrl`; this script validates the request, fetches the RSS feed, and returns the XML in the JSON response format the Worker already expects.

## Deploy once in Google Apps Script

1. Create a new standalone project at https://script.google.com/.
2. Replace the starter code in `Code.gs` with the contents of this folder's `Code.gs`.
3. In **Project Settings → Script Properties**, add:
   - Property: `RELAY_TOKEN`
   - Value: a newly generated, private random secret (at least 32 characters). Do not put the value in GitHub or share it in chat.
4. Select **Deploy → New deployment → Web app**.
5. Set **Execute as** to your account.
6. Set access to **Anyone** so the Cloudflare Worker can reach the web app. The shared token is checked on every POST request.
7. Deploy and copy the Web app URL ending in `/exec`.

## Configure the existing Cloudflare Worker

Add these two Worker secrets/variables in the Cloudflare Worker settings:

- `GOOGLE_NEWS_RSS_RELAY_URL`: the Apps Script Web app URL ending in `/exec`.
- `GOOGLE_NEWS_RSS_RELAY_TOKEN`: exactly the same secret stored as the Apps Script `RELAY_TOKEN` Script Property.

The Worker already supports these two environment bindings and sends the expected POST payload. No Telegram delivery code, D1 schema, category mapping, payment logic, or subscription logic needs to be changed for this relay.

After saving the Worker settings, redeploy the Worker if Cloudflare requires it for the changed configuration, then run the existing Google News diagnostic/test endpoint. A successful response should report `source: "google-apps-script-relay"` and a positive RSS item count.

## Reliability and security behavior

- Only HTTPS URLs on `news.google.com` under `/rss/` are accepted.
- Requests require the shared secret.
- Successful feeds are cached for 3 minutes to reduce repeated upstream requests.
- Temporary HTTP 429/5xx and network failures are retried up to three times with increasing delays.
- Permanent 4xx responses are not retried.
- Only valid RSS responses containing an RSS root and at least one item are treated as success.
- The secret is stored in Apps Script Script Properties and Cloudflare Worker secrets, not in source control.

## Important limitation

Google Apps Script uses Google's outbound fetch infrastructure, which is separate from Cloudflare's Worker network, but Google News can still return 429/503. The relay improves isolation and reduces request frequency; it cannot guarantee Google News availability. The existing Worker-side retry, cooldown, diagnostics, and duplicate protection remain in place.
