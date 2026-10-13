import { z } from "zod";

const configSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
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
