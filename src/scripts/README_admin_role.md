# Admin Role Bootstrap

This script assigns the `admin` role to a Supabase user via the Admin API.

## Requirements

Set env vars:

```bash
setx SUPABASE_URL "https://YOUR_PROJECT_REF.supabase.co"
setx SUPABASE_SERVICE_ROLE_KEY "YOUR_SERVICE_ROLE_KEY"
```

Install Python dependency:

```bash
pip install requests
```

## Run

```bash
python scripts/grant_admin_role.py --email "you@example.com"
```

The user will then have `app_metadata.role = "admin"`.
