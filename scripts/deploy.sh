#!/usr/bin/env bash
# Deploy to Vercel. Default target is the dev site (recipecheckout2.vercel.app).
# The live site (recipecheckout.vercel.app) is frozen; deploy there only on purpose:
#   scripts/deploy.sh live
set -euo pipefail
ORG=team_2KAxRVuuXdoWLXKU9FHSfVOl
case "${1:-dev}" in
  dev)  PROJECT=prj_jrzQBnOkeb4E3l42SaujMRzJA6k2 ;;  # recipecheckout2
  live) PROJECT=prj_DddHQSB6iYM5xc8iiwE3N1v3rvOq ;;  # recipecheckout
  *) echo "usage: $0 [dev|live]" >&2; exit 1 ;;
esac
VERCEL_TELEMETRY_DISABLED=1 VERCEL_ORG_ID=$ORG VERCEL_PROJECT_ID=$PROJECT \
  npx -y vercel@64.5.0 --token "$VERCEL_TOKEN" deploy --prod --yes
