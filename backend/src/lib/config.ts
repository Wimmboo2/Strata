import { z } from "zod";

const configSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Required: the server must fail closed at boot when this is missing.
  // An empty or missing secret would let anyone forge webhook signatures.
  GITHUB_WEBHOOK_SECRET: z.string().min(16),
  SYNC_CRON_SECRET: z.string().min(1).optional(),
  PORT: z.string().optional()
});

export type Config = z.infer<typeof configSchema> & { port: number };

export function loadConfig(): Config {
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid backend config: ${parsed.error.message}`);
  }
  return { ...parsed.data, port: Number(parsed.data.PORT ?? "3001") };
}
