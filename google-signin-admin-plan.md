# Implementation Plan: Google Sign-In for Administrator (`mihirkapuria@gmail.com`)

## 1. Objective
Enable secure, phishing-resistant Google OAuth 2.0 Sign-In exclusively for the authorized administrator (`mihirkapuria@gmail.com`), while keeping customer email/password authentication and manual UPI payment workflows intact.

---

## 2. Required Google Cloud & Cloudflare Configuration

### A. Google Cloud Console (OAuth 2.0 Setup)
1. Create or select the Google Cloud project for MyDigitAsset.
2. Configure the OAuth Consent Screen (External or Internal).
3. Create **OAuth 2.0 Client Credentials** (Web Application type):
   - **Authorized JavaScript Origins**: `https://mydigitasset.com` (and preview URLs).
   - **Authorized Redirect URIs**: `https://mydigitasset.com/api/auth/google/callback` (or frontend callback handler).
4. Note the generated **Google Client ID** and **Google Client Secret**.

### B. Cloudflare Worker / Pages Environment Secrets
Store sensitive credentials securely as Cloudflare encrypted secrets (never in code):
```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

---

## 3. Server-Side Identity Verification Architecture

1. **Frontend Google Sign-In Button**:
   - Render the Google Identity Services (GIS) button on the Admin Sign-In screen (`/admin`).
   - Upon successful Google authentication, Google returns an encrypted JWT `id_token` to the client.
2. **Backend Token Verification (`/api/auth/google/verify`)**:
   - The backend receives the `id_token`.
   - It validates the token server-side by querying Google's public token verification endpoint (`https://oauth2.googleapis.com/tokeninfo?id_token=...`) or verifying Google's RS256 JWT signature using public JWKs.
3. **Strict Admin Claim Check**:
   - The backend extracts `email` and `sub` (Google Subject ID) from the verified token payload.
   - It verifies that:
     ```ts
     if (payload.email !== 'mihirkapuria@gmail.com' || !payload.email_verified) {
       return new Response('Unauthorized administrator identity', { status: 403 });
     }
     ```
   - If verified, the server issues an encrypted, time-limited admin session token tied specifically to `mihirkapuria@gmail.com`.

---

## 4. Secure Administrator Provisioning
* In the D1 database migration schema, the admin user record (`mihirkapuria@gmail.com`) is pre-seeded with `role = 'admin'` and an optional `google_sub` column.
* Password login for `mihirkapuria@gmail.com` can be entirely disabled or superseded by Google Sign-In, eliminating password brute-force or credential stuffing risks for the admin account.
* Regular customers continue using email/password authentication and manual UPI payment submissions.

---

## 5. Security Summary & Safeguards
* **Zero Credential Exposure**: Client code never handles client secrets.
* **Cryptographic Verification**: Identity tokens are verified directly against Google's authorization servers.
* **Isolated Impact**: Customer authentication, trial calculations, and manual UPI workflows remain 100% unaffected.
