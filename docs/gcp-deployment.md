# GCP Deployment

Both services are deployed to **Cloud Run** on GCP. Deployments are triggered automatically when changes are pushed to the `main` branch via the GitHub Actions workflow at [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

---

## Architecture on GCP

```
GitHub (main branch push)
        │
        ▼
GitHub Actions (deploy.yml)
  ├── Build Backend Docker image  ──► Artifact Registry
  │   └── Deploy to Cloud Run (secret-santa-backend)  ◄── Firestore
  │
  └── Build Web Docker image  ──► Artifact Registry
      └── Deploy to Cloud Run (secret-santa-web)
              │
              └── (uses BACKEND_URL from Backend deploy output)
```

| Service | Cloud Run name | Port | DB |
|---|---|---|---|
| Backend (NestJS) | `secret-santa-backend` | 3000 | Cloud Firestore |
| Frontend (Angular/nginx) | `secret-santa-web` | 8080 | — |

---

## One-Time GCP Setup

These steps are required once per GCP project before the first deployment.

### 1. Create a GCP project

```bash
gcloud projects create YOUR_PROJECT_ID
gcloud config set project YOUR_PROJECT_ID
gcloud billing projects link YOUR_PROJECT_ID --billing-account=YOUR_BILLING_ACCOUNT
```

### 2. Enable required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com
```

### 3. Create Artifact Registry repository

```bash
gcloud artifacts repositories create secret-santa \
  --repository-format=docker \
  --location=us-central1 \
  --description="Secret Santa container images"
```

### 4. Create a Firestore database

```bash
gcloud firestore databases create --location=us-central1
```

### 5. Create a service account for GitHub Actions

```bash
# Create the service account
gcloud iam service-accounts create github-actions-sa \
  --display-name="GitHub Actions — Secret Santa"

# Grant required roles
SA="github-actions-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/run.developer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/iam.serviceAccountTokenCreator"

# Allow the SA to act as the Compute Engine default SA (required by Cloud Run deploy)
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")
gcloud iam service-accounts add-iam-policy-binding \
  ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --member="serviceAccount:$SA" \
  --role="roles/iam.serviceAccountUser"
```

### 6. Configure Workload Identity Federation

This allows GitHub Actions to authenticate to GCP without storing a long-lived service account key.

```bash
# Create the WIF pool
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions Pool"

# Create the OIDC provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='YOUR_GITHUB_ORG/secret-santa-web'"

# Allow the GitHub repo to impersonate the service account
POOL_ID=$(gcloud iam workload-identity-pools describe github-pool \
  --location=global --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding $SA \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/YOUR_GITHUB_ORG/secret-santa-web"

# Note the WIF provider resource name for use in GitHub secrets
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --format="value(name)"
# → projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

### 7. Allow public access to Cloud Run services

The `--allow-unauthenticated` flag in the deploy command does not always set the IAM binding (org policies can block it). Grant public invoker access explicitly:

```bash
gcloud run services add-iam-policy-binding secret-santa-backend \
  --region=us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker"

gcloud run services add-iam-policy-binding secret-santa-web \
  --region=us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

> If this fails, your GCP org has a policy blocking public Cloud Run services (`constraints/iam.allowedPolicyMemberDomains`). Check GCP Console → IAM & Admin → Organization Policies.

---

## GitHub Repository Secrets

Add the following secrets to your GitHub repository under **Settings → Secrets and variables → Actions**:

| Secret | Value | How to get it |
|---|---|---|
| `GCP_PROJECT_ID` | `your-gcp-project-id` | GCP Console → project selector |
| `GCP_SA_EMAIL` | `github-actions-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com` | Step 5 above |
| `GOOGLE_CLIENT_ID` | `123456789-abc.apps.googleusercontent.com` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID |
| `JWT_SECRET` | random 32+ char string | `openssl rand -base64 32` |
| `WIF_PROVIDER` | `projects/123.../providers/github-provider` | Output of last command in Step 6 |

---

## Deployment Workflow

Once the one-time setup is done, deployments are fully automated:

1. **Push to `main`** triggers `.github/workflows/deploy.yml`
2. The workflow authenticates to GCP using Workload Identity Federation (no stored keys)
3. **Backend image** is built from `apps/backend/Dockerfile`, pushed to Artifact Registry, deployed to Cloud Run
4. **Web image** is built from `apps/web/Dockerfile` with the Backend's Cloud Run URL injected as `BACKEND_URL`, then deployed to Cloud Run

### Manual deployment (optional)

To deploy manually without going through CI:

```bash
# Authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Configure Docker
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and push Backend
BACKEND_IMAGE="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/secret-santa/backend:manual"
docker build -f apps/backend/Dockerfile -t $BACKEND_IMAGE .
docker push $BACKEND_IMAGE

# Deploy Backend
gcloud run deploy secret-santa-backend \
  --image=$BACKEND_IMAGE \
  --region=us-central1 \
  --allow-unauthenticated \
  --port=3000 \
  --set-env-vars="DB_PROVIDER=firestore,GCP_PROJECT_ID=YOUR_PROJECT_ID"

# Get the Backend URL
BACKEND_URL=$(gcloud run services describe secret-santa-backend \
  --region=us-central1 --format="value(status.url)")

# Build and push Web
WEB_IMAGE="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/secret-santa/web:manual"
docker build -f apps/web/Dockerfile --build-arg BACKEND_URL=$BACKEND_URL -t $WEB_IMAGE .
docker push $WEB_IMAGE

# Deploy Web
gcloud run deploy secret-santa-web \
  --image=$WEB_IMAGE \
  --region=us-central1 \
  --allow-unauthenticated \
  --port=8080
```

---

## Post-Deployment

After the first deployment, get the service URLs:

```bash
gcloud run services describe secret-santa-backend --region=us-central1 --format="value(status.url)"
gcloud run services describe secret-santa-web --region=us-central1 --format="value(status.url)"
```

Open the web URL in your browser to use the application.

### Verify the Backend is healthy

```bash
BACKEND_URL=$(gcloud run services describe secret-santa-backend \
  --region=us-central1 --format="value(status.url)")
curl $BACKEND_URL/health
# → {"status":"ok"}
```

---

## Updating After Code Changes

Simply push to `main` — the CI/CD pipeline handles the rest. Each deployment creates a new Docker image tagged with the Git commit SHA, ensuring full traceability between code and what is running in production.
