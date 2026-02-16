#!/bin/bash
set -e

gcloud run deploy gsc-mcp-server \
  --source . \
  --region us-central1 \
  --project acidrain-429721 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 10
