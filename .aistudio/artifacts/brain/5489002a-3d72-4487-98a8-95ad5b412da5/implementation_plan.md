# Implementation Plan: Category-Specific Subscriptions & Unified Eligibility

## 1. Overview & Objective
Update the MyDigitAsset backend (`worker.ts`) and database schema (`migrations/0003_category_subscriptions_unique.sql`) to fully evaluate category-specific subscriptions (`user_subscriptions`) for each requested category during news eligibility checks and Telegram news delivery. Maintain account-level and category-level administrator access overrides without altering billing/payment records, and prevent duplicate user-category subscription entries.

---

## 2. Proposed Database Changes (Additive & Safe)
Create a new additive migration file `migrations/0003_category_subscriptions_unique.sql`:
- Add a unique index to prevent duplicate subscription records for the same user and category:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_user_category ON user_subscriptions(user_id, category_id);
  ```
- Fully preserves all existing tables, users, payments, categories, telegram tokens, and delivery logs.

---

## 3. Backend Worker Changes (`worker.ts`)
Update the eligibility verification and news-delivery dispatch logic:
- **Unified Eligibility Function / Endpoint (`/api/news/eligibility` & delivery dispatch)**:
  - Accept an optional `categoryId` query parameter (defaulting to the user's primary category if omitted).
  - Check access hierarchy in order:
    1. **Account-level Admin Override**: `users.access_override === 1` grants access across all categories.
    2. **Category-level Access Override**: `user_subscriptions.access_override === 1` grants access for that specific category.
    3. **Active Paid Subscription**: `user_subscriptions.status === 'active_paid'` with valid `subscription_expiry`.
    4. **Active Trial**: `user_subscriptions.status === 'trial'` with current time < `trial_expiry`.
  - Fallback gracefully to user-level trial/subscription data for legacy records where `user_subscriptions` rows are pending creation.
- **Access Override Endpoints**:
  - Ensure updating manual overrides touches *only* `access_override` and `audit_logs`, leaving `payment_status`, `subscription_status`, `trial_start`, and `trial_expiry` strictly untouched.

---

## 4. Test Suite Additions (`tests/security.test.ts`)
Add test cases in `tests/security.test.ts` verifying:
1. Category-specific subscription access (user has active trial in Category A, but expired in Category B).
2. Category-level administrator access override (`user_subscriptions.access_override = 1` grants access to that category).
3. Account-level administrator access override (`users.access_override = 1` grants access across all categories).
4. Prevention of duplicate `user_subscriptions` for the same user and category via database constraint.
5. Verification that manual access override changes only override and audit logs.

---

## 5. Execution Safeguards
- No modification of production systems or external databases.
- No D1 execution or deployment until explicit user approval.
