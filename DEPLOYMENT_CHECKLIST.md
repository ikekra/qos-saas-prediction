# Deployment Checklist

Use this as the release runbook for production rollout.

## 0) Local Quality Gate (must pass before deploy)
- [x] `npm.cmd run lint` (warnings allowed, no lint errors)
- [x] `npm.cmd run build` (production bundle generated)
- [x] CI workflow added: `.github/workflows/quality-gate.yml` (`lint + build`)

## 1) Database (Supabase)
- [ ] Apply pending migration: `20260319090000_web_services_ratings_favorites.sql`
- [ ] Run `npx supabase db push` against production project
- [ ] Verify tables/policies exist for ratings and favorites

## 2) Edge Functions Deploy
- [ ] Deploy `create-web-service`
- [ ] Deploy `run-qos-test`
- [ ] Deploy `compare-services`
- [ ] Deploy `test-service`
- [ ] Deploy `token-topup`
- [ ] Deploy `token-stream`
- [ ] Deploy `get-recommendations`
- [ ] Deploy `payments-create-order`
- [ ] Deploy `payments-verify`
- [ ] Deploy `payments-webhook`
- [ ] Deploy `predict-qos`
- [ ] Deploy `seed-services` (optional)

## 3) Edge Function Environment Variables (production)
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY` (for user-authenticated edge calls that need anon context)
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `ALLOWED_ORIGINS` (comma-separated; first entry used as CORS allow origin)
- [ ] `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (if payments enabled)
- [ ] `RAZORPAY_WEBHOOK_SECRET` (for webhook signature validation)

## 4) Frontend Environment Variables
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] `VITE_ML_API_URL`
- [ ] `VITE_PAYMENT_ENABLED`
- [ ] `VITE_TOKEN_POLL_INTERVAL_MS`

## 5) Types, Artifacts, and Repo Hygiene
- [ ] Regenerate Supabase types used by frontend:
  `src/integrations/supabase/types.ts`
- [ ] Confirm no secrets in repo (`.env` not committed)
- [ ] Confirm large model artifacts are intentionally tracked or moved to storage

## 6) Smoke Tests (staging or production)
- [ ] Register/Login works and dashboard loads
- [ ] Add a new service (validates `create-web-service`)
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
npx supabase db push
npx supabase functions deploy run-qos-test
```
