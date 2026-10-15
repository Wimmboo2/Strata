import { getAdminClient } from "../lib/supabase-admin";

// Rows stuck in "processing" longer than this are treated as abandoned
// (crashed worker) and may be taken over. Handlers are idempotent upserts,
// so a rare double-process is wasted work, never corruption.
const STALE_MS = 5 * 60 * 1000;

/**
 * Claim a GitHub delivery id for processing. Concurrency-safe: the primary
 * key guarantees exactly one inserter wins; everyone else converges on the
 * stored status. Returns true when this caller should process the event.
 */
export async function claimDelivery(deliveryId: string): Promise<boolean> {
  const supabase = getAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("webhook_deliveries")
    .insert({ delivery_id: deliveryId, status: "processing", received_at: now });
  if (!error) return true;
  if (error.code !== "23505") throw error;

  const { data, error: readError } = await supabase
    .from("webhook_deliveries")
    .select("status,received_at")
    .eq("delivery_id", deliveryId)
    .single();
  if (readError || !data) return true; // Row vanished; process rather than drop.
  if (data.status === "ok") return false;
  const ageMs = Date.now() - new Date(data.received_at as string).getTime();
  if (data.status === "processing" && ageMs < STALE_MS) return false;

  const { data: took, error: takeError } = await supabase
    .from("webhook_deliveries")
    .update({ status: "processing", received_at: now })
    .eq("delivery_id", deliveryId)
    .in("status", ["failed", "processing"])
    .select("delivery_id");
  if (takeError) throw takeError;
  return (took?.length ?? 0) > 0;
}

/** Record the outcome so redeliveries either skip (ok) or retry (failed). */
export async function completeDelivery(deliveryId: string, ok: boolean): Promise<void> {
  try {
    const supabase = getAdminClient();
    await supabase
      .from("webhook_deliveries")
      .update({ status: ok ? "ok" : "failed" })
      .eq("delivery_id", deliveryId);
  } catch (err) {
    // Never mask the handler result; a missed update just means a
    // redelivery will reprocess (handlers are idempotent).
    console.error("completeDelivery failed", err);
  }
}
