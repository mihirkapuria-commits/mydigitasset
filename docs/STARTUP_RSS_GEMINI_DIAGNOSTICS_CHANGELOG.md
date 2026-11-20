# Startup Google News + Gemini diagnostics — change record

Date: 2026-11-20
Target branch: `main`

## Purpose
Add an administrator-only diagnostic so the Startup news pipeline can be tested in two independent parts: Google News RSS and Gemini. This helps identify whether an RSS 503 or a Gemini API/model/quota/capacity error is blocking Startup news delivery.

## Changes made

### 1. `telegram-news.ts`
- Added `diagnoseStartupGoogleNews(env)`: makes one direct Startup Google News RSS request, with a 20-second timeout, and reports HTTP status, response timing, item count, selected response headers, and a sanitized response preview.
- The RSS diagnostic does not change the shared Google News cooldown.
- Added `diagnoseStartupGemini(env)`: checks the configured Gemini key by sending 10 synthetic sample articles through the existing Startup summarization path. It reports the model, duration, number of returned stories, a short output preview, and any error.
- Synthetic sample content is used; no real news is used for this Gemini diagnostic.
- Improved Gemini HTTP error reporting to include the HTTP status and a limited provider error message.

### 2. `worker.ts`
- Added administrator-protected endpoint: `POST /api/admin/news/startup/diagnostics`.
- Runs the Google News and Gemini diagnostics independently and returns both results.
- Does not call Telegram or send Telegram messages.

### 3. `src/components/AdminPortal.tsx`
- Added the **Diagnose Startup RSS + Gemini** button.
- Added a confirmation prompt and an on-screen diagnostic result panel.

## Explicitly unchanged
- No Telegram bot token or channel/chat ID configuration was changed.
- No Telegram message is sent by this diagnostic endpoint.
- No D1 schema or subscription/payment rules were changed.
- No Free-Tier Users Management features were changed.

## Main-branch commits
These three commits contain the code changes:
- `f1f26c56b5a585b2aef18eba7fe31708156680c3` — `telegram-news.ts`
- `51599ea2c5d0cff0233a1cd4949386e70527dadf` — `worker.ts`
- `504aaac1eb2d69c108f2bcba23c3ac13c81fed45` — `src/components/AdminPortal.tsx`

## Rollback
To undo only these three code commits, from a clean checkout of the repository run:

```bash
git revert --no-edit 504aaac1eb2d69c108f2bcba23c3ac13c81fed45 51599ea2c5d0cff0233a1cd4949386e70527dadf f1f26c56b5a585b2aef18eba7fe31708156680c3
```

This creates new revert commits; it does not erase repository history. Review any later changes that depend on these diagnostics before reverting.

## Validation / deployment note
The GitHub Actions validation workflow for the diagnostic change passed. The Cloudflare preview build reported a failure, so the live Cloudflare deployment must be checked separately. A successful GitHub validation is not proof that Cloudflare deployed the new Worker or Admin Portal.
