import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(16),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CORS_ORIGIN: z.string().min(1),
  FILES_DIR: z.string().min(1).default("/app/apps/api/uploads"),
});

export const env = envSchema.parse(process.env);

