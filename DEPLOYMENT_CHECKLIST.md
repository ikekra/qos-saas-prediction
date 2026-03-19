# Deployment Checklist

## Database Migrations
- [ ] Apply migration `20260319090000_web_services_ratings_favorites.sql`

## Edge Functions (Deploy)
- [ ] `create-web-service`
- [ ] `run-qos-test`
- [ ] `compare-services`
- [ ] `test-service`
- [ ] `seed-services` (optional)

## Edge Function Environment Variables
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`

## Supabase Types
- [ ] Regenerate `src/integrations/supabase/types.ts`

## Smoke Tests
- [ ] Login and view Dashboard
- [ ] Add a new service (uses `create-web-service`)
- [ ] Run a QoS test and verify `tests` updated
- [ ] Compare services and see live metrics
- [ ] View QoS Reports (realtime badge shows Connected)
- [ ] Create a rating + favorite (stored in `web_service_*`)

## Optional
- [ ] Seed sample services via `seed-services`
