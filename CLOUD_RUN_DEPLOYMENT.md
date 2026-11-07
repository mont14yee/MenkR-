# MenkR- Google Cloud Run Deployment & Operations Manual

This guide provides step-by-step instructions for deploying MenkR- to **Google Cloud Run** using Google Cloud CLI (`gcloud`), Artifact Registry, Secret Manager, and Cloud SQL.

---

## 1. Prerequisites & Required Google Cloud APIs

Ensure you have the Google Cloud SDK (`gcloud`) installed and authenticated:
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Enable the necessary GCP services:
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com
```

---

## 2. Dedicated Runtime Service Account & IAM Roles

For security compliance (principle of least privilege), run Cloud Run under a dedicated service account rather than the Compute Engine default service account.

### Create Service Account
```bash
gcloud iam service-accounts create menkir-runner \
  --description="Runtime service account for MenkR- Cloud Run service" \
  --display-name="MenkR Cloud Run Runner"
```

### Grant Secret Manager Access
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:menkir-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Grant Cloud SQL Client Access (if using Cloud SQL)
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:menkir-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

---

## 3. Secret Manager Configuration

Store all sensitive keys in Google Cloud Secret Manager. **Never bake API keys or database passwords into container images or source code.**

### A. Store Gemini API Key
```bash
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key \
  --data-file=- \
  --replication-policy="automatic"
```

### B. Store PostgreSQL Connection String
```bash
# Example Cloud SQL UNIX socket connection string:
# postgresql://DB_USER:DB_PASS@/DB_NAME?host=/cloudsql/YOUR_PROJECT_ID:REGION:INSTANCE_NAME
echo -n "postgresql://menkir_user:YOUR_DB_PASSWORD@/menkir_db?host=/cloudsql/YOUR_PROJECT_ID:europe-west1:menkir-db" | \
  gcloud secrets create menkir-database-url \
  --data-file=- \
  --replication-policy="automatic"
```

---

## 4. Container Build via Artifact Registry & Cloud Build

### Create Docker Repository in Artifact Registry
```bash
REGION="europe-west1"
REPO="menkir-repo"

gcloud artifacts repositories create $REPO \
  --repository-format=docker \
  --location=$REGION \
  --description="Docker repository for MenkR- applications"
```

### Build & Push Container Image
Run Google Cloud Build from the root of the MenkR- repository:
```bash
IMAGE_TAG="$REGION-docker.pkg.dev/YOUR_PROJECT_ID/$REPO/menkir-app:$(git rev-parse --short HEAD || echo 'latest')"

gcloud builds submit --tag "$IMAGE_TAG"
```

---

## 5. Deploying to Google Cloud Run

### Option A: Direct CLI Deployment
Deploy the container with automatic scaling, secret injection, and port 8080 configuration:

```bash
gcloud run deploy menkir-app \
  --image="$IMAGE_TAG" \
  --region="$REGION" \
  --platform=managed \
  --service-account="menkir-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --port=8080 \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=300 \
  --set-env-vars="NODE_ENV=production,PORT=8080" \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest,DATABASE_URL=menkir-database-url:latest" \
  --add-cloudsql-instances="YOUR_PROJECT_ID:europe-west1:menkir-db" \
  --allow-unauthenticated
```

### Option B: Declarative Deployment (`cloudrun.yaml`)
Update `PROJECT_ID` inside `cloudrun.yaml` and execute:
```bash
gcloud run services replace cloudrun.yaml --region="$REGION"
```

---

## 6. Post-Deployment Verification

Once deployed, retrieve the service URL:
```bash
SERVICE_URL=$(gcloud run services describe menkir-app --region="$REGION" --format="value(status.url)")
echo "MenkR- is live at: $SERVICE_URL"
```

### Verification Checks:
1. **Container Health & Readiness Probe**:
   ```bash
   curl -i "$SERVICE_URL/healthz"
   # Expected output: HTTP 200 with status: "healthy", ready: true, service: "menkir-api"
   ```
2. **AI Provider Status**:
   ```bash
   curl -i "$SERVICE_URL/api/ai/status"
   # Expected output: configured: true, defaultModel: "gemini-3.8-flash"
   ```
3. **Frontend SPA Delivery & Route Fallback**:
   ```bash
   curl -i "$SERVICE_URL/projects"
   # Expected output: HTTP 200 delivering index.html (SPA routing verified)
   ```

---

## 7. Rollback & Revision Management Plan

Cloud Run retains past revisions automatically and enables instant traffic shifting:

### List Recent Revisions
```bash
gcloud run revisions list --service=menkir-app --region="$REGION"
```

### Instant Traffic Rollback (Zero Downtime)
To immediately revert 100% of production traffic to a previous known good revision:
```bash
gcloud run services update-traffic menkir-app \
  --region="$REGION" \
  --to-revisions=PREVIOUS_REVISION_NAME=100
```

### Canary / Gradual Rollout
To roll out a new revision gradually to test stability:
```bash
gcloud run services update-traffic menkir-app \
  --region="$REGION" \
  --to-revisions=NEW_REVISION_NAME=10,PREVIOUS_REVISION_NAME=90
```

---

## 8. Known Production Limitations & Operational Guidelines

1. **Container Filesystem Ephemerality**:
   - Cloud Run container instances have stateless, in-memory local disks.
   - Files uploaded to `data/secure_library_files` are preserved only for the lifespan of the container instance.
   - **Recommended Cloud Run Solution**: Attach a Google Cloud Storage bucket via Cloud Run Volume Mounts (Cloud Storage FUSE) to `/app/data/secure_library_files` with zero code changes:
     ```bash
     gcloud run services update menkir-app \
       --region="$REGION" \
       --add-volume=name=library-files,type=cloud-storage,bucket=YOUR_GCS_BUCKET_NAME \
       --add-volume-mount=volume=library-files,mount-path=/app/data/secure_library_files
     ```
2. **Database Connection Limits**:
   - When autoscaling up to multiple instances, ensure Cloud SQL connection limits are not exceeded. Each container instance pool is configured with `max: 10` connections.
   - For high-concurrency enterprise deployments (>20 instances), configure Cloud SQL PgBouncer or Cloud SQL Auth Proxy.
3. **Graceful Shutdown Behavior**:
   - The server listens for `SIGTERM` and `SIGINT` signals sent by Cloud Run during scale-down events. It stops accepting new requests, drains in-flight connections, and terminates the database pool with a 10-second timeout guarantee.
