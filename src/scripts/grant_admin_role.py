import argparse
import json
import os
from typing import Any, Dict

import requests


def build_auth_header() -> Dict[str, str]:
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not service_key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is required")
    return {"Authorization": f"Bearer {service_key}", "apikey": service_key}


def fetch_user_by_email(base_url: str, headers: Dict[str, str], email: str) -> Dict[str, Any]:
    url = f"{base_url}/auth/v1/admin/users"
    params = {"email": email}
    response = requests.get(url, headers=headers, params=params, timeout=20)
    response.raise_for_status()
    users = response.json().get("users", [])
    if not users:
        raise RuntimeError(f"No user found for email: {email}")
    return users[0]


def update_user_metadata(base_url: str, headers: Dict[str, str], user_id: str, metadata: Dict[str, Any]) -> None:
    url = f"{base_url}/auth/v1/admin/users/{user_id}"
    payload = {"app_metadata": metadata}
    response = requests.put(url, headers=headers, json=payload, timeout=20)
    response.raise_for_status()


def main() -> None:
    parser = argparse.ArgumentParser(description="Grant admin role via Supabase Admin API")
    parser.add_argument("--email", required=True, help="User email to grant admin role")
    parser.add_argument("--project-url", required=False, default=os.getenv("SUPABASE_URL"), help="Supabase project URL")
    args = parser.parse_args()

    if not args.project_url:
        raise RuntimeError("SUPABASE_URL is required")

    headers = build_auth_header()

    user = fetch_user_by_email(args.project_url, headers, args.email)
    app_metadata = user.get("app_metadata", {}) or {}
    app_metadata["role"] = "admin"

    update_user_metadata(args.project_url, headers, user["id"], app_metadata)
    print(json.dumps({"status": "ok", "user_id": user["id"], "email": args.email, "role": "admin"}))


if __name__ == "__main__":
    main()
