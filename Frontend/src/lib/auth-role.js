import { supabase } from "@/integrations/supabase/client";
/**
 * Fetch the highest-priority role for a user via the user_roles table.
 * Admin > moderator > user. Falls back to "user" (guest-equivalent).
 */
export async function getUserRole(userId) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("moderator")) return "moderator";
  return "user";
}
export function roleHomePath(role) {
  // Admin dashboard, guest dashboard — both mount at /dashboard.
  // The dashboard reads the role and adapts its surface.
  return "/dashboard";
}
