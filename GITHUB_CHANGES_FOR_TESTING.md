# GitHub Changes for Testing

This file records changes made for testing MyDigitAsset so they can be reviewed or reversed later.

**Repository:** `mihirkapuria-commits/mydigitasset`  
**Branch:** `main`  
**Rule:** Add a dated entry for every future code or configuration change made for this testing work. Never record secret values.

---

## 1. Protected India Startups test endpoint

- **Commit:** `3e036d9788cf4cadc57faffdb0ad86ebd6998799`
- **File:** `worker.ts`
- **Change:** Added the POST endpoint `/api/test/india-startups-news`.
- **Purpose:** Allow a manually triggered India Startups digest test, protected by the `NEWS_TEST_SECRET` request header.
- **Safety:** The test calls the existing news-test function and does not update the daily delivery lock.
- **Status:** Previously deployed and used for testing.

## 2. Switch the news source from Google News RSS to the Google News webpage

- **Commit:** `06a8d1d69480e86d44999efc293db7acaf5c18ba`
- **File:** `telegram-news.ts`
- **Change:** Replaced the Google News RSS URL with a Google News search webpage URL and introduced webpage headline extraction.
- **Purpose:** Avoid the RSS endpoint that returned HTTP 503.
- **Note:** This first webpage-parser version was immediately refined in the next commit. It should be reviewed together with that correction.

## 3. Refine Google News webpage headline extraction

- **Commit:** `4a14c30db3472ac97c210374e1b2b856531cb021`
- **File:** `telegram-news.ts`
- **Change:** Corrected the webpage parsing expressions and added extraction for Google News story links in both article-card and fallback layouts.
- **Purpose:** Improve extraction of headlines and Google News story URLs from the Google News search webpage.
- **Source policy:** Google News only. No other news provider and no RSS feed.
- **Status:** Committed to `main`; deployment and end-to-end Telegram test are pending.

## Cloudflare runtime secrets used for testing

The following secret names were configured in the Cloudflare Worker runtime. Their values are intentionally not recorded here:

- `NEWS_TEST_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY`

Never add secret values, API keys, bot tokens, passwords, or private credentials to this file or to GitHub.

## Test observations

- The protected test endpoint accepted the test secret.
- An earlier test reached the news-fetching step but Google News RSS returned HTTP 503.
- The webpage-based Google News implementation has not yet been confirmed by a successful Telegram digest.
- The manual test endpoint is intended not to affect the scheduled daily delivery lock.

## Reversal guidance

- Each code change above has its own Git commit, so the exact prior file version can be inspected and restored through GitHub history.
- Before reverting anything, check later commits and review the complete affected file.
- Do not revert the test endpoint or other changes without confirming which functionality should remain.
