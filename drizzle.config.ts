import { defineConfig } from "drizzle-kit";
import { getEnv } from "./src/config/env.js";

const env = getEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schema/*.ts",
  out: "./src/database/migrations",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
