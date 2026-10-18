import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export async function requireUser(existing?: User | null): Promise<User> {
  if (existing) return existing;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) {
    throw new Error("Authentication required.");
  }
  return data.user;
}
