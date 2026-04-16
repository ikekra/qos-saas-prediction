# Deployment Checklist

Use this as the release runbook for production rollout.

## 0) Local Quality Gate (must pass before deploy)
- [x] `npm.cmd run lint` (warnings allowed, no lint errors)
- [x] `npm.cmd run build` (production bundle generated)
- [x] CI workflow added: `.github/workflows/quality-gate.yml` (`lint + build`)

## 1) Database (Supabase)
- [ ] Run `npx supabase db push` against production project
- [ ] Confirm latest migrations applied through `20260416120000_fix_performance_quota_scope_ambiguity.sql`
- [ ] Verify `public.web_services`, `public.user_profiles`, `public.teams`, `public.team_members`, and `public.team_invitations` exist
- [ ] Verify team quota/activity objects exist: `public.quota_usage`, `public.team_activity_logs`, `public.team_quota_overview`, `public.team_member_usage_breakdown`

## 2) Edge Functions Deploy
- [ ] Deploy `team-api`
- [ ] Deploy `create-web-service`
- [ ] Deploy `admin-web-services`
- [ ] Deploy `run-qos-test`
- [ ] Deploy `compare-services`
- [ ] Deploy `test-service`
- [ ] Deploy `token-topup`
- [ ] Deploy `token-stream`
- [ ] Deploy `get-recommendations`
- [ ] Deploy `payments-create-order`
- [ ] Deploy `payments-verify`
- [ ] Deploy `payments-webhook`
- [ ] Deploy `admin-control-plane`
- [ ] Deploy `predict-qos`
- [ ] Deploy `seed-services` (optional)
- [ ] Deploy `sync-publicapis` (if using directory sync)

## 3) Edge Function Environment Variables (production)
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY` (for user-authenticated edge calls that need anon context)
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `ALLOWED_ORIGINS` (comma-separated; first entry used as CORS allow origin)
- [ ] `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (if payments enabled)
- [ ] `RAZORPAY_WEBHOOK_SECRET` (for webhook signature validation)
- [ ] `PAYMENT_MODE` (`test`/`sandbox` during development)
- [ ] `TOKEN_COST_LATENCY` / `TOKEN_COST_THROUGHPUT` / `TOKEN_COST_UPTIME` / `TOKEN_COST_FULL_REPORT`
- [ ] `TOKEN_COST_HISTORICAL_ANALYSIS` / `TOKEN_COST_ANOMALY_SCAN`
- [ ] `LATENCY_ALERT_MS` / `UPTIME_ALERT_PERCENT` / `THROUGHPUT_DROP_ALERT`
- [ ] `TOKEN_PRICE_SMALL(_TOKENS)` / `TOKEN_PRICE_MEDIUM(_TOKENS)` / `TOKEN_PRICE_LARGE(_TOKENS)`

## 4) Frontend Environment Variables
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] `VITE_ML_API_URL`
- [ ] `VITE_PAYMENT_ENABLED`
- [ ] `VITE_TOKEN_POLL_INTERVAL_MS`
- [ ] `VITE_TOKEN_COST_LATENCY` / `VITE_TOKEN_COST_THROUGHPUT` / `VITE_TOKEN_COST_UPTIME` / `VITE_TOKEN_COST_FULL_REPORT`
- [ ] `VITE_TOKEN_COST_HISTORICAL_ANALYSIS` / `VITE_TOKEN_COST_ANOMALY_SCAN`

## 5) Types, Artifacts, and Repo Hygiene
- [ ] Regenerate Supabase types used by frontend:
  `src/integrations/supabase/types.ts`
- [ ] Confirm no secrets in repo (`.env` not committed)
- [ ] Confirm large model artifacts are intentionally tracked or moved to storage

## 6) Smoke Tests (staging or production)
- [ ] Register/Login works and dashboard loads
- [ ] Pro user can create team in `/team`
- [ ] Standard user is blocked from team creation with clear upgrade message
- [ ] Add a new service (validates `create-web-service`)
- [ ] Add/update service in `/admin/web-services` (validates admin + schema fallback behavior)
- [ ] Run QoS test and verify `tests` row updates
- [ ] Compare services and verify metrics render
- [ ] QoS Reports shows realtime connected status
- [ ] Create rating + favorite and verify persistence
- [ ] Execute token top-up flow and verify payment records

## 7) Release Decision
- [ ] All checkboxes above complete
- [ ] Rollout window approved
- [ ] Monitoring/alerts ready
- [ ] Go live

---

## Useful Commands

```powershell
cd "c:\Users\Asus\Desktop\saas-qos\New folder\source\src"
npm.cmd run check
npm.cmd run backend:deploy
npx supabase db push
npx supabase functions deploy run-qos-test
```
