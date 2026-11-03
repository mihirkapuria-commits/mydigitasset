# GitHub Changes for Testing — MyDigitAsset

**Purpose:** A permanent record of the code and Cloudflare configuration changes made for the India Startups news-delivery test, including test results and how to reverse the code changes.

**Repository:** `mihirkapuria-commits/mydigitasset`  
**Branch:** `main`  
**Worker:** `mydigitasset`  
**Worker URL:** `https://mydigitasset.mihirkapuria.workers.dev`  
**Scope:** India Startups test delivery only. This is not a complete history of every change ever made to the MyDigitAsset website.

> Never store secret values, API keys, bot tokens, passwords, or private credentials in this document or in GitHub.

---

## A. Summary of what was done

1. Added a separate, secret-protected manual test endpoint for the India Startups news digest.
2. Configured the required Cloudflare Worker runtime secrets.
3. Tested the endpoint from Windows PowerShell.
4. The test reached the Google News RSS fetching step, but Google News RSS repeatedly returned HTTP 503.
5. As requested, changed the news source from Google News RSS to the Google News search webpage. No other news provider was added.
6. Corrected the first webpage parser implementation in a follow-up commit.
7. Created this record so the work can be reviewed and reversed if needed.

**Current state at the time this note was written:** The latest webpage-fetching code is committed to GitHub `main`, but its Cloudflare deployment and successful end-to-end Telegram test have not yet been confirmed.

---

## B. Code changes (GitHub commits)

### 1. Add a protected India Startups manual test endpoint

- **Commit:** `3e036d9788cf4cadc57faffdb0ad86ebd6998799`
- **Commit message:** Add secret-protected India Startups news test trigger
- **File changed:** `worker.ts`
- **What changed:**
  - Added the optional Worker environment binding `NEWS_TEST_SECRET`.
  - Added a constant-time secret comparison helper.
  - Added the POST route `/api/test/india-startups-news`.
  - The route checks the `x-news-test-secret` request header.
  - If authorized, it calls the existing India Startups test-delivery function.
- **Why:** To trigger a manual digest test without needing to use the admin portal.
- **Important safety detail:** The test function is intended not to update the scheduled daily delivery lock.
- **Observed result:** The endpoint accepted the supplied test secret and proceeded into the news-fetching function. This showed that the route and secret check were working at that time.
- **Commit link:** https://github.com/mihirkapuria-commits/mydigitasset/commit/3e036d9788cf4cadc57faffdb0ad86ebd6998799

### 2. Replace Google News RSS with the Google News search webpage

- **Commit:** `06a8d1d69480e86d44999efc293db7acaf5c18ba`
- **Commit message:** Fetch India Startups headlines from Google News webpage
- **File changed:** `telegram-news.ts`
- **What changed:**
  - Replaced the Google News RSS URL with a Google News search webpage URL.
  - Changed the fetch process from reading RSS/XML items to reading the webpage HTML.
  - Added initial extraction of Google News story headlines and links.
  - Removed the RSS tag-reading helper that was no longer needed.
- **Why:** Google News RSS had returned HTTP 503 during testing.
- **Source policy:** Google News only. This change does not add another news provider.
- **Important note:** The first version contained incorrectly escaped parser expressions. The next commit corrected them. Review this commit together with commit 4 below.
- **Commit link:** https://github.com/mihirkapuria-commits/mydigitasset/commit/06a8d1d69480e86d44999efc293db7acaf5c18ba

### 3. Correct the Google News webpage parser

- **Commit:** `4a14c30db3472ac97c210374e1b2b856531cb021`
- **Commit message:** Fix Google News webpage article extraction
- **File changed:** `telegram-news.ts`
- **What changed:**
  - Corrected the HTML parsing expressions.
  - Added extraction attempts for Google News story links in article-card and fallback layouts.
  - Added support for article links whose paths contain `read` or `articles`.
  - Added a clearer error if Google News loads but no headlines can be extracted.
- **Why:** To correct the parser in the previous commit before testing the webpage approach.
- **Current status:** Committed to `main`; Cloudflare deployment and successful Telegram delivery are not yet confirmed.
- **Commit link:** https://github.com/mihirkapuria-commits/mydigitasset/commit/4a14c30db3472ac97c210374e1b2b856531cb021

### 4. Create this testing record

- **Commit:** `93eccd1d8081931cb13e6d4ea5658fe86d83596b`
- **File created:** `GITHUB_CHANGES_FOR_TESTING.md`
- **Purpose:** Keep a readable record of the test changes, configuration names, results, and reversal guidance.
- **Commit link:** https://github.com/mihirkapuria-commits/mydigitasset/commit/93eccd1d8081931cb13e6d4ea5658fe86d83596b

---

## C. Cloudflare configuration changes

The following runtime secrets were added or corrected in the Cloudflare Worker settings. Their values are deliberately not written here.

| Secret name | Purpose |
|---|---|
| `NEWS_TEST_SECRET` | Protects the manual test endpoint |
| `TELEGRAM_BOT_TOKEN` | Allows the Worker to send messages using the Telegram bot |
| `GEMINI_API_KEY` | Allows the news process to request Gemini summaries |

Configuration notes:
- `NEWS_TEST_SECRE` was initially entered with a missing final `T`; it was corrected to `NEWS_TEST_SECRET`.
- `NEWS_TEST_SECRET` was configured as an encrypted Secret, not a plain-text variable.
- `TELEGRAM_BOT_TOKEN` and `GEMINI_API_KEY` were also configured as encrypted Secrets.
- The Cloudflare environment selector shown during setup was `ProductionPreviews Base`.
- The user confirmed clicking Deploy after adding the secrets.
- Secret values must remain only in Cloudflare. Do not put them in `wrangler.toml`, source files, this note, or chat messages.
- These Cloudflare dashboard actions do not have Git commit IDs. This note records them separately from source-code commits.

---

## D. Test history and observed results

1. A direct Telegram API test had previously succeeded, and a test message appeared in the India Startups Telegram channel (message ID 30). This confirmed basic bot-to-channel connectivity at that time; it did not test the complete news-generation process.
2. The manual test endpoint was first reached with the test secret, but the response said `TELEGRAM_BOT_TOKEN is not configured`. The Telegram bot token was then added as a Cloudflare Secret and deployed.
3. After all three secrets were configured, the endpoint passed authorization and proceeded to fetch news.
4. The RSS-based test returned: `Google News RSS request failed with HTTP 503.`
5. Retrying after a short wait returned the same HTTP 503.
6. The user chose to continue using Google News only, but to fetch its search webpage rather than its RSS feed.
7. The webpage implementation was committed, then its parser was corrected in a follow-up commit.
8. **Not yet verified:** Whether the deployed Worker can successfully fetch the Google News webpage, extract headlines, obtain Gemini summaries, and send the final digest to Telegram.

---

## E. What this testing work has NOT changed

As part of these specific test changes:
- No D1 database schema or records were intentionally changed.
- No customer accounts, subscriptions, payments, or category access were intentionally changed.
- No daily news schedule or cron setting was intentionally changed.
- No other news category was intentionally switched to the webpage-fetching method.
- No alternative news provider was added.
- No Telegram webhook was added.
- The manual test endpoint is separate from the normal scheduled delivery process.

---

## F. Reversal and recovery guide

Every source-code change above has its own Git commit. The commit links in section B open the exact historical change.

If the webpage approach does not work:
1. Review commit `4a14c30db3472ac97c210374e1b2b856531cb021` and commit `06a8d1d69480e86d44999efc293db7acaf5c18ba` together.
2. To return the news-fetching code to the version before the Google News webpage experiment, restore the `telegram-news.ts` version from the parent of commit `06a8d1d69480e86d44999efc293db7acaf5c18ba`.
3. Keep or remove the separate test endpoint only after deciding whether manual testing is still needed.
4. Review the complete current file and later commits before any revert. Prefer a new revert commit rather than rewriting Git history.
5. A code revert does not automatically undo Cloudflare runtime secret settings. Review those separately before removing any secret.

**Do not perform a revert automatically.** First identify the exact problem and confirm which feature should remain.

---

## G. Current next action

Deploy the latest `main` code to the Cloudflare Worker, then run the protected POST test endpoint again. If Google News webpage fetching works, verify that the digest arrives in the India Startups Telegram channel. If it fails, record the exact error here before deciding on another change.


---

## H. Deferred checks and MyDigitAsset core-product worklist

These items are deliberately recorded for later. The immediate priority is to get the core news product working, not to spend more time investigating deployment screens.

### Deployment and India Startups test — deferred verification

- [ ] Confirm whether the active Cloudflare production version contains the latest GitHub `main` code, especially commit `4a14c30db3472ac97c210374e1b2b856531cb021`.
- [ ] Current Cloudflare screen showed active version `svgfe421098`, 100% traffic, 0 requests/sec, 0% error rate, and 0ms median CPU time. This confirms traffic allocation, not the source commit.
- [ ] Review the deployment's source/build details or logs later. The version-ID link opened the website, not the deployment details.
- [ ] Do not click **Retry build** until there is a reason to do so.
- [ ] Run the protected India Startups test after confirming the deployment, or when deliberately choosing to test the currently active version.
- [ ] Confirm the complete flow: Google News webpage fetch → headline extraction → Gemini summary → Telegram digest received.
- [ ] Record the exact response/error and outcome here. The earlier RSS HTTP 503 is historical; the webpage approach has not yet been verified.

### Core product priorities

1. [ ] Make the India Startups daily news digest work reliably end to end using Google News webpage fetching, Gemini summarization, and Telegram delivery.
2. [ ] Confirm normal scheduled delivery at the configured time (06:15 IST) and ensure the manual test does not interfere with the daily delivery lock.
3. [ ] Add clear delivery logs and a safe way to identify whether a daily digest was sent, failed, or skipped, without creating duplicate messages.
4. [ ] Once India Startups is stable, extend the same approved and tested delivery approach to the remaining 14 news categories/channels.
5. [ ] Verify that each channel receives one daily news digest, with the content belonging to that category.
6. [ ] Implement and verify the separate advertising digest: one combined ad message per channel every 14 days; ads must not be mixed into the daily news message.
7. [ ] Build and test admin controls for category/channel settings, delivery schedules, ad campaigns, and customer access after the news-delivery foundation is stable.
8. [ ] Later return to deferred website work: admin portal error, customer registration/category loading, password recovery, and Google Sign-In. Do not let these distract from the current news-delivery milestone.

### Working rule

Proceed one small step at a time. Keep a record of source-code commits and test outcomes. Do not change code, database records, secrets, or deployment settings without explaining the exact proposed change and receiving the user's approval.


---

## I. Reusable category news-delivery foundation — 3 November 2026

### Approved implementation

The user approved refactoring the India Startups news-delivery code into a reusable category pipeline. The work was committed to GitHub `main`.

- Commit `94c94a87e3bd4d389dc1c9ca605f2048655300a3` — `Refactor Telegram news delivery into reusable category pipeline`.
- Follow-up correction: `3b9e42357dbd1b56cf24dc3fc424f54a75d85730` — `Remove duplicate constants from news delivery refactor`.
- File changed: `telegram-news.ts` only.

### What changed

- Introduced a category news-source configuration shape containing category ID, topic name and Google News webpage URL.
- Kept India Startups as the only configured source for now.
- Added a shared scheduled-delivery pipeline that receives the category configuration.
- Added a shared active-category lookup that reads the category title and Telegram channel ID from D1.
- Added a shared manual-test pipeline; the existing exported India Startups test function remains as a wrapper.
- Generalized Google News webpage fetching, Gemini prompt topic and Telegram digest formatting helpers.
- Preserved the existing cron entry-point function name and the authenticated India Startups manual-test entry point.
- Preserved the daily per-category delivery key and sending/sent/failed lock behavior.
- Manual test still does not read or modify the scheduled delivery lock.
- No D1 migration, database record, secret, Worker route, cron schedule, or other category/channel was changed.

### Verification status

- GitHub confirms both commits on `main`.
- A source inspection confirmed the existing exported scheduled and test entry points remain present and old helper references were removed.
- GitHub reported no commit status checks for the corrective commit. A local TypeScript build/lint and live Cloudflare/Telegram end-to-end test have not yet been run.
- Do not describe the refactor as fully tested or all-category delivery as implemented.
- Next: verify the active Cloudflare deployment includes the latest `main` commit, run the India Startups manual test, and check the Telegram message. Record the exact result.
- After India Startups works, add further category configurations one at a time. Do not enable all categories until each configuration and channel ID is verified.

### Rollback

To review or reverse this refactor, compare or revert commits `94c94a87e3bd4d389dc1c9ca605f2048655300a3` and `3b9e42357dbd1b56cf24dc3fc424f54a75d85730`. Do not revert without first confirming the desired rollback and checking later dependent commits.


---

## J. Fix missing static-assets binding — 3 November 2026

### Approved change

The user approved adding the explicit `ASSETS` binding to the existing Cloudflare static-assets configuration.

- **Commit:** `dcd82beb99dd4e154c3680eb7c8e4ed6a77bb5ee`
- **Commit message:** `Fix Worker static asset binding`
- **File changed:** `wrangler.toml`
- **Branch:** `main`
- **Commit link:** https://github.com/mihirkapuria-commits/mydigitasset/commit/dcd82beb99dd4e154c3680eb7c8e4ed6a77bb5ee

### Exact change

Under the existing `[assets]` section, added this one line:

```toml
binding = "ASSETS"
```

The section now reads:

```toml
[assets]
directory = "./dist"
binding = "ASSETS"
```

### Why

The Worker code calls `env.ASSETS.fetch(request)`, but the previous Wrangler configuration did not name the static-assets binding. This could leave `env.ASSETS` undefined and cause the observed `Cannot read properties of undefined (reading 'fetch')` runtime error.

### Scope and safety

- Only one configuration line was added to `wrangler.toml`.
- No TypeScript source code, D1 database, migration, customer/payment data, secrets, category settings, Telegram configuration, or cron schedule was changed.
- This is a configuration correction; it does not by itself prove that the India Startups news-delivery test now works.
- The observed runtime errors were on automated scanner requests to unrelated paths (`/debug/default/view?panel=config` and `/.vscode/sftp.json`). This binding issue explains those Worker crashes; it does not yet explain the separate HTTP 500 from the India Startups test endpoint.

### Deployment and verification

- GitHub confirms the configuration commit on `main`.
- **Cloudflare deployment status:** Not yet verified after this commit.
- **Runtime verification:** Not yet performed after this commit.
- Next: confirm Cloudflare has deployed commit `dcd82beb99dd4e154c3680eb7c8e4ed6a77bb5ee`. Then, if the India Startups manual test still fails, inspect logs for the exact `/api/test/india-startups-news` request and record its actual error. Do not assume the unrelated scanner errors are the cause of the test endpoint's HTTP 500.

### Rollback

If a rollback is required, review commit `dcd82beb99dd4e154c3680eb7c8e4ed6a77bb5ee` and remove only the added `binding = "ASSETS"` line in a new, approved commit. Do not roll back automatically.
