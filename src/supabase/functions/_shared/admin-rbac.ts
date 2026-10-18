import { createClient, type User } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "./cors.ts";

type AdminRoleContext = {
  user: User;
  authClient: ReturnType<typeof createClient>;
  adminClient: ReturnType<typeof createClient>;
  isProjectOwner: boolean;
};

type AdminRoleOptions = {
  requireOwner?: boolean;
};

const DEFAULT_OWNER_EMAIL = "chagankekra13@gmail.com";

function hasAdminRole(user: User): boolean {
  return user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin";
}

function isOwnerUser(user: User): boolean {
  const ownerId = (Deno.env.get("PROJECT_OWNER_USER_ID") ?? "").trim();
  const ownerEmail = (Deno.env.get("PROJECT_OWNER_EMAIL") ?? DEFAULT_OWNER_EMAIL).trim().toLowerCase();

  if (ownerId && user.id === ownerId) return true;
  if (ownerEmail && (user.email ?? "").toLowerCase() === ownerEmail) return true;
  return false;
}

export async function requireAdminContext(
  req: Request,
  options: AdminRoleOptions = {},
): Promise<{ context?: AdminRoleContext; response?: Response }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !serviceRole) {
    return {
      response: jsonResponse({ error: "Supabase environment is not configured." }, 500, req),
    };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRole);

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return { response: jsonResponse({ error: "Unauthorized" }, 401, req) };
  }

  if (!hasAdminRole(user)) {
    return { response: jsonResponse({ error: "Forbidden. Admin access required." }, 403, req) };
  }

  const isProjectOwner = isOwnerUser(user);
  if (options.requireOwner && !isProjectOwner) {
    return {
      response: jsonResponse({ error: "Forbidden. Project owner access only." }, 403, req),
    };
  }

  return {
    context: {
      user,
      authClient,
      adminClient,
      isProjectOwner,
    },
  };
}
