import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Logger } from "pino";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema/index.js";

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseClientOptions {
  connectionString: string;
  logger: Logger;
  maxConnections?: number;
}

export interface DatabaseClient {
  db: Database;
  sql: Sql;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export const createDatabaseClient = (
  options: DatabaseClientOptions,
): DatabaseClient => {
  const sql = postgres(options.connectionString, {
    max: options.maxConnections ?? 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: (notice) => {
      options.logger.debug({ notice }, "Received PostgreSQL notice");
    },
  });

  const db = drizzle(sql, { schema });

  return {
    db,
    sql,
    ping: async () => {
      await sql`select 1`;
    },
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
};
