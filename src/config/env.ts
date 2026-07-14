import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

loadDotEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  HOST: z.string().trim().min(1),
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) =>
        value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must start with postgres:// or postgresql://",
    ),
  LOG_LEVEL: z.enum([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ]),
  WORDPRESS_TIMEOUT: z.coerce.number().int().min(100),
  WORDPRESS_PAGE_SIZE: z.coerce.number().int().min(1).max(100),
  IMPORT_BATCH_SIZE: z.coerce.number().int().min(1).max(100),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().min(1).max(100),
  EMBEDDING_CONCURRENCY: z.coerce.number().int().min(1).max(50),
  EMBEDDING_MODEL: z.string().trim().min(1),
  OLLAMA_URL: z.string().trim().url(),
  OLLAMA_TIMEOUT: z.coerce.number().int().min(100),
  SEARCH_DEFAULT_LIMIT: z.coerce.number().int().min(1).max(100),
  SEARCH_MAX_LIMIT: z.coerce.number().int().min(1).max(100),
  SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85),
  MAX_CONTEXT_CHARS: z.coerce.number().int().min(500).max(50000),
  DEFAULT_CONTEXT_RESULTS: z.coerce.number().int().min(1).max(100),
  MAX_CONTEXT_RESULTS: z.coerce.number().int().min(1).max(100),
  CACHE_TTL: z.coerce.number().int().min(1),
  MEMORY_DEFAULT_CONTEXT: z.coerce.number().int().min(1).max(100),
  MEMORY_MAX_CONTEXT: z.coerce.number().int().min(1).max(100),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (input: NodeJS.ProcessEnv): Env => {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const issues = result.error.issues
      .map(({ path, message }) => `${path.join(".")}: ${message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return result.data;
};

export const getEnv = (): Env => parseEnv(process.env);
