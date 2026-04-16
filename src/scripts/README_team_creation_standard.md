# Team Creation Standard (v1)

This project now uses a standardized team creation flow across frontend and backend.

## Frontend standard
File:
- `src/pages/team/TeamDashboard.tsx`

Rules:
1. Require `team name` (2-100 chars).
2. Normalize `team slug` to lowercase kebab-case.
3. Validate slug format: `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
4. Show field-level errors for invalid name/slug.
5. Block submit while create request is in progress.

## Backend standard
File:
- `supabase/functions/team-api/index.ts`

Rules:
1. Re-validate name/slug server-side.
2. Enforce single-team membership and owner constraints.
3. Enforce plan eligibility (`pro`/`enterprise`), including billing fallback.
4. Return standardized error codes (examples):
   - `TEAM_PLAN_NOT_ELIGIBLE`
   - `TEAM_SLUG_CONFLICT`
   - `TEAM_MEMBERSHIP_CONFLICT`
5. Use atomic behavior: rollback team row if owner membership insert fails.

Success payload:
```json
{
  "success": true,
  "process": "standard-v1",
  "team": { "...": "..." }
}
```

