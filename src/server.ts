import { buildApp } from "./app.js";
import { createLogger } from "./common/logger/logger.js";
import { getEnv } from "./config/env.js";
import { createDatabaseClient } from "./database/client.js";
import { createRepositories } from "./database/repositories.js";
import { createServices } from "./services/index.js";
import { createEmbeddingWorker } from "./workers/EmbeddingWorker.js";

export const bootstrap = async () => {
  const env = getEnv();
  const logger = createLogger({
    level: env.LOG_LEVEL,
    environment: env.NODE_ENV,
  });
  const database = createDatabaseClient({
    connectionString: env.DATABASE_URL,
    logger,
  });

  await database.ping();

  const repositories = createRepositories(database);
  const services = createServices({
    repositories,
    logger,
    env,
  });
  const embeddingWorker = createEmbeddingWorker({
    embeddingService: services.embeddings,
    logger,
  });
  const app = await buildApp({
    env,
    logger,
    database,
    repositories,
    services,
  });

  app.addHook("onClose", async () => {
    await embeddingWorker.stop();
  });

  embeddingWorker.start();

  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });

  logger.info(
    {
      host: env.HOST,
      port: env.PORT,
    },
    "AI Memory service started",
  );

  return app;
};

if (process.env.NODE_ENV !== "test") {
  bootstrap().catch((error: unknown) => {
    const fallbackLogger = createLogger({
      level: "error",
      environment:
        process.env.NODE_ENV === "production" ? "production" : "development",
    });

    fallbackLogger.fatal({ err: error }, "Failed to start AI Memory service");
    process.exit(1);
  });
}
