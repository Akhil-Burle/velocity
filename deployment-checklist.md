# Velocity — Deployment Checklist

Follow these steps in order. Each step must succeed before moving to the next.

---

## Phase 1 — Code Fixes (Already Applied)

- [x] `JWT_SECRET` no longer has a weak hardcoded fallback in source — now fails fast in production if not set
- [x] CORS reads allowed origins from `ALLOWED_ORIGINS` env var instead of hardcoded localhost list
- [x] `BACKEND_URL` and `FRONTEND_URL` have no hardcoded localhost fallbacks — must be set as env vars in production
- [x] Frontend `Dashboard.tsx` error message no longer references `localhost:3001`
- [x] `backend/Dockerfile` created (Node 20 slim, production deps only, health check included)
- [x] `backend/.dockerignore` created (excludes node_modules, .env, scripts, test files)
- [x] `frontend/firebase.json` created (SPA rewrite rule, cache headers, security headers)
- [x] `backend/.env.example` created (all required vars documented with placeholders)
- [x] `frontend/.env.example` created (all required vars documented with placeholders)
- [x] `deployment-commands.sh` created (exact gcloud + firebase CLI commands for this project)

---

## Phase 2 — Pre-Deploy Secrets Setup

- [ ] **Verify `.env` is not git-tracked**: run `git ls-files backend/.env` — should return no output
- [ ] **Generate a strong JWT secret**:
  ```
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
  Copy the output — use it as `velocity-jwt-secret` in Secret Manager.

- [ ] **Enable GCP APIs** (run once):
  See `deployment-commands.sh` → STEP 1

- [ ] **Create all secrets in Secret Manager** with real values:
  See `deployment-commands.sh` → STEP 2
  - [ ] `velocity-jwt-secret` — new strong random secret (not the one currently in .env)
  - [ ] `velocity-mongodb-uri` — MongoDB Atlas connection string
  - [ ] `velocity-gemini-api-key` — Gemini API key
  - [ ] `velocity-google-client-id` — Google OAuth client ID
  - [ ] `velocity-google-client-secret` — Google OAuth client secret
  - [ ] `velocity-google-refresh-token` — Google refresh token
  - [ ] `velocity-github-token` — GitHub PAT
  - [ ] `velocity-maps-api-key` — Google Maps API key

---

## Phase 3 — Backend Deployment

- [ ] **Deploy backend to Cloud Run** from repo root:
  See `deployment-commands.sh` → STEP 3
  ```
  gcloud run deploy velocity-backend --source=./backend ...
  ```

- [ ] **Note the Cloud Run URL** — printed at end of deploy. Looks like:
  `https://velocity-backend-xxxxxxxxxx-uc.a.run.app`

- [ ] **Grant service account IAM roles**:
  See `deployment-commands.sh` → STEP 4
  - [ ] `roles/secretmanager.secretAccessor`
  - [ ] `roles/aiplatform.user`

- [ ] **Smoke test the backend health endpoint**:
  ```
  curl https://YOUR_CLOUD_RUN_URL/api/health
  ```
  Expected: `{"status":"ok","mongoConnected":true,...}`
  - [ ] `status` is `"ok"`
  - [ ] `mongoConnected` is `true`
  - [ ] `geminiConfigured` is `true` (or `aiBackend` is `"vertex_ai"`)

---

## Phase 4 — Frontend Build + Deployment

- [ ] **Update `frontend/.env`** with real Cloud Run URL:
  ```
  VITE_API_BASE_URL=https://YOUR_CLOUD_RUN_URL/api
  VITE_DEMO_MODE=false
  ```
  _(or `VITE_DEMO_MODE=true` if you want judges to land directly on the dashboard)_

- [ ] **Build the frontend**:
  ```
  cd frontend
  npm ci
  npm run build
  ```
  Confirm `frontend/dist/` is populated with `index.html` and asset files.

- [ ] **Initialize Firebase Hosting** (first time only):
  ```
  cd frontend
  firebase init hosting
  ```
  - Public directory: `dist`
  - Single-page app: **Yes**
  - Overwrite `dist/index.html`: **No**

- [ ] **Deploy frontend to Firebase Hosting**:
  ```
  cd frontend
  firebase use YOUR_GCP_PROJECT_ID
  firebase deploy --only hosting
  ```

- [ ] **Note the Firebase Hosting URL** — printed at end of deploy. Looks like:
  `https://velocity-demo.web.app`

---

## Phase 5 — Wire Up Production URLs

- [ ] **Update backend env vars with Firebase Hosting URL**:
  See `deployment-commands.sh` → STEP 7
  ```
  gcloud run services update velocity-backend \
    --set-env-vars="FRONTEND_URL=https://YOUR_FIREBASE_URL,ALLOWED_ORIGINS=https://YOUR_FIREBASE_URL,GOOGLE_REDIRECT_URI=https://YOUR_CLOUD_RUN_URL/api/auth/google/callback,..."
  ```

- [ ] **Test CORS** — should NOT be blocked:
  ```
  curl -H "Origin: https://YOUR_FIREBASE_URL" -X OPTIONS https://YOUR_CLOUD_RUN_URL/api/health -v
  ```
  Look for `Access-Control-Allow-Origin` in the response headers.

---

## Phase 6 — OAuth Console Configuration (Manual)

You must do these in the browser — no CLI equivalent.

### Google Cloud Console → Credentials
URL: `https://console.cloud.google.com/apis/credentials` → select your OAuth 2.0 client

- [ ] Add to **Authorized JavaScript origins**:
  - `https://YOUR_FIREBASE_HOSTING_URL`

- [ ] Add to **Authorized redirect URIs**:
  - `https://YOUR_CLOUD_RUN_URL/api/auth/google/callback`

> The existing `http://localhost:3001/api/auth/google/callback` entry can stay — it won't break anything and is needed for local dev.

### GitHub OAuth App (for Panic Mode repo creation)
The GitHub token (`GITHUB_TOKEN`) is a Personal Access Token, not an OAuth app — **no console config needed** for it. Panic Mode repo creation will work as-is once the token is in Secret Manager.

---

## Phase 7 — End-to-End Live Test

Open the live Firebase Hosting URL in a **fresh incognito window** and test each item:

- [ ] **Public access**: page loads without login — not blocked, no auth wall
- [ ] **Landing page loads** with no console errors
- [ ] **Guest login**: click "Continue as Guest" → lands on dashboard with tasks
- [ ] **Demo login**: username `demo`, password `velocity2026` → dashboard with seeded tasks
- [ ] **Google Sign-In**: click "Sign in with Google" → Google consent → redirected back to `/dashboard`
- [ ] **OmniBar voice**: press Ctrl+K, speak or type a command → intent classified → countdown → action executes
- [ ] **OmniBar TTS**: AI response is spoken back (requires Google TTS configured)
- [ ] **Brain Dump**: type "React lab due Friday" → tasks extracted by Gemini
- [ ] **Chaos Scanner**: drop a screenshot → tasks extracted from image
- [ ] **Panic Mode**: activate on a RED task → checklist + boilerplate generated → GitHub repo created
- [ ] **Triage**: click Triage → task deferred or Ultimatum triggered
- [ ] **Calendar sync**: Calendar page shows real Google Calendar events
- [ ] **Agent Activity Log**: `/agent-log` page shows all autonomous actions taken
- [ ] **Velocity Credits**: completing a task awards credits and shows the level-up toast
- [ ] **Negotiate**: RED task → "Negotiate" → email draft generated

---

## Phase 8 — Firestore Security Rules

If you have migrated to Firestore (currently using MongoDB Atlas):
- [ ] Verify Firestore rules are NOT in open dev mode (`allow read, write: if true`)
- [ ] Deploy production rules that scope reads/writes to authenticated users only

> **Note**: This app currently uses MongoDB Atlas, not Firestore directly in the data layer. This item applies only if you added Firestore for any feature (e.g., Agent Log persistence).

---

## Final Verification

- [ ] **Backend URL is live**: `curl https://YOUR_CLOUD_RUN_URL/api/health` returns 200
- [ ] **Frontend URL is live**: `https://YOUR_FIREBASE_URL` loads in browser
- [ ] **No secrets in source control**: `git log --all --full-history -- backend/.env` returns nothing
- [ ] **CORS is locked**: a request from a random origin (e.g., `https://evil.com`) is blocked
- [ ] **Google OAuth redirect URI matches** what's registered in Google Cloud Console
- [ ] **Demo mode decision**: set `VITE_DEMO_MODE=true` and rebuild if you want judges to skip auth

---

## Quick Reference — Key URLs After Deploy

| Thing | URL |
|-------|-----|
| Backend (Cloud Run) | `https://velocity-backend-xxxxxxxxxx-uc.a.run.app` |
| Frontend (Firebase) | `https://velocity-demo.web.app` |
| Health check | `https://BACKEND_URL/api/health` |
| Google OAuth callback | `https://BACKEND_URL/api/auth/google/callback` |
| GCP Console | `https://console.cloud.google.com/run?project=YOUR_PROJECT` |
| Firebase Console | `https://console.firebase.google.com/project/YOUR_PROJECT/hosting` |
| Secret Manager | `https://console.cloud.google.com/security/secret-manager?project=YOUR_PROJECT` |
