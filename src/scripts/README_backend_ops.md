# Backend Ops (Standard Process)

Use this process to keep database schema, function code, and plan eligibility in sync.

## One-command deploy
From project root (`source/src`):

```powershell
npm run backend:deploy
```

This script runs:
1. `npx supabase db push`
2. Deploys critical functions:
   - `team-api`
   - `create-web-service`
   - `admin-web-services`
   - `payments-create-order`
   - `payments-verify`
   - `payments-webhook`
   - `run-qos-test`
   - `sync-publicapis`
   - `admin-control-plane`

## Why this matters
- Team creation depends on plan resolution from `user_profiles`, auth metadata, and billing data.
- Service creation/admin directory depend on `web_services` schema and compatibility fallbacks.
- Deploying only one function can leave backend behavior inconsistent.

## Post-deploy checks
1. Pro user can create a team at `/team`.
2. Standard user cannot create team (expected block).
3. Service create works in `/services/new`.
4. Admin service create/update works in `/admin/web-services`.
