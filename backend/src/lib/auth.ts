import type { Request } from "express";
import { getAdminClient } from "./supabase-admin";

/**
 * Resolve the caller's Supabase user id from the request.
 *
 * The browser sends its Supabase access token as `Authorization: Bearer
 * <token>`. We validate that token with the auth server through the admin
 * client and trust the resulting user id — never a user id taken from the
 * request body or query string, which the client controls.
 *
 * Returns null for a missing, malformed or invalid token.
 */
export async function resolveUserId(req: Request): Promise<string | null> {
  const header = req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  if (!token) return null;
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
