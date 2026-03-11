# PublicAPIs.io Sync

This sync imports up to 1,500 entries from the PublicAPIs.io directory into `public.web_services` and is safe to run daily.

Dataset source:
```
https://publicapis.io/api-directory
```

## Prerequisites
- Ensure the `web_services` table exists by applying:
  - `src/supabase/migrations/20260228090000_create_web_services.sql`
- Ensure public read policy exists for directory browsing.

## Environment variables
Set these before running:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Run once (manual)
```bash
node src/scripts/sync_publicapis.mjs
```

## Daily sync options
Option A: Windows Task Scheduler
1. Create a daily task to run:
   - Program: `node`
   - Arguments: `src/scripts/sync_publicapis.mjs`
   - Start in: `c:\Users\Asus\Desktop\New folder (2)\New folder\source\src`

Option B: Supabase Scheduled Function
1. Deploy the `sync-publicapis` Edge Function.
2. Schedule it daily in the Supabase dashboard.

Edge function file:
- `src/supabase/functions/sync-publicapis/index.ts`

## Notes
- The parser tries to extract entries from Next.js data, JSON-LD, and HTML fallback.
- If the directory HTML structure changes, the parser may need adjustments.
