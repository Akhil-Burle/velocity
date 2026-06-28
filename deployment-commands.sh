#!/usr/bin/env bash
# ─── Velocity — Google Cloud Deployment Commands ─────────────────────────────
# Run these commands IN ORDER. Read every section's comments before executing.
# Wherever you see REPLACE_WITH_*, substitute your actual value.
#
# Prerequisites:
#   gcloud CLI installed and authenticated: gcloud auth login
#   firebase CLI installed: npm install -g firebase-tools && firebase login
#   Docker Desktop running (for local build testing, optional)
#
# Your GCP project ID — set this once and the rest of the commands use it.
# ─────────────────────────────────────────────────────────────────────────────

export GCP_PROJECT="REPLACE_WITH_YOUR_GCP_PROJECT_ID"
export REGION="us-central1"
export SERVICE_NAME="velocity-backend"

# ─── STEP 1: Enable required Google Cloud APIs ────────────────────────────────
# Run once per project. Safe to re-run.

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  calendar-json.googleapis.com \
  texttospeech.googleapis.com \
  oauth2.googleapis.com \
  --project="${GCP_PROJECT}"


# ─── STEP 2: Create secrets in Secret Manager ─────────────────────────────────
# Each secret is created empty here; you add the actual value in the next block.
# Format: gcloud secrets create NAME --project=PROJECT
# Then:   echo -n "VALUE" | gcloud secrets versions add NAME --data-file=-

gcloud secrets create velocity-jwt-secret          --project="${GCP_PROJECT}" --replication-policy="automatic"
gcloud secrets create velocity-mongodb-uri         --project="${GCP_PROJECT}" --replication-policy="automatic"
gcloud secrets create velocity-gemini-api-key      --project="${GCP_PROJECT}" --replication-policy="automatic"
gcloud secrets create velocity-google-client-id    --project="${GCP_PROJECT}" --replication-policy="automatic"
gcloud secrets create velocity-google-client-secret --project="${GCP_PROJECT}" --replication-policy="automatic"
gcloud secrets create velocity-google-refresh-token --project="${GCP_PROJECT}" --replication-policy="automatic"
gcloud secrets create velocity-github-token        --project="${GCP_PROJECT}" --replication-policy="automatic"
gcloud secrets create velocity-maps-api-key        --project="${GCP_PROJECT}" --replication-policy="automatic"

# ── Add secret VALUES (run each line separately, substitute real values) ──────
# Tip: use printf instead of echo to avoid trailing newlines.

printf "REPLACE_WITH_STRONG_64_CHAR_RANDOM_SECRET" | \
  gcloud secrets versions add velocity-jwt-secret --data-file=- --project="${GCP_PROJECT}"

printf "mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/velocity?retryWrites=true&w=majority" | \
  gcloud secrets versions add velocity-mongodb-uri --data-file=- --project="${GCP_PROJECT}"

printf "REPLACE_WITH_GEMINI_API_KEY" | \
  gcloud secrets versions add velocity-gemini-api-key --data-file=- --project="${GCP_PROJECT}"

printf "REPLACE_WITH_GOOGLE_CLIENT_ID" | \
  gcloud secrets versions add velocity-google-client-id --data-file=- --project="${GCP_PROJECT}"

printf "REPLACE_WITH_GOOGLE_CLIENT_SECRET" | \
  gcloud secrets versions add velocity-google-client-secret --data-file=- --project="${GCP_PROJECT}"

printf "REPLACE_WITH_GOOGLE_REFRESH_TOKEN" | \
  gcloud secrets versions add velocity-google-refresh-token --data-file=- --project="${GCP_PROJECT}"

printf "REPLACE_WITH_GITHUB_TOKEN" | \
  gcloud secrets versions add velocity-github-token --data-file=- --project="${GCP_PROJECT}"

printf "REPLACE_WITH_MAPS_API_KEY" | \
  gcloud secrets versions add velocity-maps-api-key --data-file=- --project="${GCP_PROJECT}"


# ─── STEP 3: Deploy backend to Cloud Run ──────────────────────────────────────
# Cloud Build builds the image from ./backend using the Dockerfile.
# Cloud Run injects PORT=8080 automatically.
# --allow-unauthenticated: the app handles its own JWT auth; Cloud Run doesn't need IAM auth.
#
# ⚠️  Run this from the REPO ROOT (not inside /backend).
# After this completes, Cloud Run prints the service URL. Note it — you need it
# for STEP 4 (CORS update) and for the frontend build in STEP 5.

gcloud run deploy "${SERVICE_NAME}" \
  --source="./backend" \
  --platform="managed" \
  --region="${REGION}" \
  --project="${GCP_PROJECT}" \
  --allow-unauthenticated \
  --port=8080 \
  --memory="512Mi" \
  --cpu="1" \
  --min-instances=0 \
  --max-instances=5 \
  --timeout=60 \
  --concurrency=80 \
  --set-env-vars="NODE_ENV=production,GOOGLE_CLOUD_PROJECT=${GCP_PROJECT},GOOGLE_CLOUD_LOCATION=${REGION},DEMO_MODE=true,EMAIL_DRAFT_ONLY=false" \
  --set-secrets="\
JWT_SECRET=velocity-jwt-secret:latest,\
MONGODB_URI=velocity-mongodb-uri:latest,\
GEMINI_API_KEY=velocity-gemini-api-key:latest,\
GOOGLE_CLIENT_ID=velocity-google-client-id:latest,\
GOOGLE_CLIENT_SECRET=velocity-google-client-secret:latest,\
GOOGLE_REFRESH_TOKEN=velocity-google-refresh-token:latest,\
GITHUB_TOKEN=velocity-github-token:latest,\
GOOGLE_MAPS_API_KEY=velocity-maps-api-key:latest"

# ── After deploy: capture the Cloud Run URL ───────────────────────────────────
export BACKEND_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform=managed --region="${REGION}" --project="${GCP_PROJECT}" \
  --format="value(status.url)")
echo "Backend URL: ${BACKEND_URL}"

# ── Update BACKEND_URL, FRONTEND_URL, GOOGLE_REDIRECT_URI, ALLOWED_ORIGINS ───
# These can't be set until we know the URL. Run this after noting both URLs.
# Replace REPLACE_WITH_FIREBASE_HOSTING_URL with your Firebase URL after STEP 6.

gcloud run services update "${SERVICE_NAME}" \
  --platform="managed" \
  --region="${REGION}" \
  --project="${GCP_PROJECT}" \
  --set-env-vars="\
NODE_ENV=production,\
GOOGLE_CLOUD_PROJECT=${GCP_PROJECT},\
GOOGLE_CLOUD_LOCATION=${REGION},\
DEMO_MODE=true,\
EMAIL_DRAFT_ONLY=false,\
BACKEND_URL=${BACKEND_URL},\
FRONTEND_URL=https://REPLACE_WITH_FIREBASE_HOSTING_URL,\
GOOGLE_REDIRECT_URI=${BACKEND_URL}/api/auth/google/callback,\
ALLOWED_ORIGINS=https://REPLACE_WITH_FIREBASE_HOSTING_URL"


# ─── STEP 4: Grant Cloud Run service account access to Secret Manager ─────────
# Cloud Run uses a default compute service account. Grant it secretAccessor role.

export SA_EMAIL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform=managed --region="${REGION}" --project="${GCP_PROJECT}" \
  --format="value(spec.template.spec.serviceAccountName)")

# If the above is empty, Cloud Run uses the default compute SA:
export SA_EMAIL="${GCP_PROJECT}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

# Grant Vertex AI access (for Gemini calls via Vertex AI)
gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/aiplatform.user"


# ─── STEP 5: Build frontend with production backend URL ───────────────────────
# ⚠️  Do this from the repo root. Substitute the real Cloud Run URL.

# Update frontend/.env with the real backend URL
# (or edit the file manually before building)
echo "VITE_API_BASE_URL=${BACKEND_URL}/api" > frontend/.env
echo "VITE_DEMO_MODE=false" >> frontend/.env

# Build the static bundle
cd frontend
npm ci
npm run build
cd ..

# The static files are now in frontend/dist/ — ready for Firebase Hosting.


# ─── STEP 6: Deploy frontend to Firebase Hosting ──────────────────────────────
# Initialize Firebase project (run once — choose "Hosting" only, use existing project)
# firebase init hosting
# When prompted:
#   What do you want to use as your public directory? → dist
#   Configure as single-page app? → Yes
#   Overwrite dist/index.html? → No
#   (firebase.json already exists — the init may ask to overwrite; say No)

cd frontend
firebase use "${GCP_PROJECT}"
firebase deploy --only hosting
cd ..

# ── After deploy: note the Firebase Hosting URL ───────────────────────────────
# Firebase will print something like:
#   Hosting URL: https://velocity-demo.web.app
# Note this URL — you need it for STEP 3's update and for OAuth console config.


# ─── STEP 7: Redeploy backend with Firebase Hosting URL in env vars ───────────
# Now that you know the Firebase Hosting URL, update the backend env and redeploy.
# Replace REPLACE_WITH_FIREBASE_HOSTING_URL below with the real URL from STEP 6.

gcloud run services update "${SERVICE_NAME}" \
  --platform="managed" \
  --region="${REGION}" \
  --project="${GCP_PROJECT}" \
  --set-env-vars="\
NODE_ENV=production,\
GOOGLE_CLOUD_PROJECT=${GCP_PROJECT},\
GOOGLE_CLOUD_LOCATION=${REGION},\
DEMO_MODE=true,\
EMAIL_DRAFT_ONLY=false,\
BACKEND_URL=${BACKEND_URL},\
FRONTEND_URL=https://REPLACE_WITH_FIREBASE_HOSTING_URL,\
GOOGLE_REDIRECT_URI=${BACKEND_URL}/api/auth/google/callback,\
ALLOWED_ORIGINS=https://REPLACE_WITH_FIREBASE_HOSTING_URL"


# ─── STEP 8: Smoke test the live backend ─────────────────────────────────────
# Should return {"status":"ok",...}
curl "${BACKEND_URL}/api/health"

# Test CORS from frontend origin (replace with real Firebase URL):
curl -H "Origin: https://REPLACE_WITH_FIREBASE_HOSTING_URL" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS "${BACKEND_URL}/api/health" -v
