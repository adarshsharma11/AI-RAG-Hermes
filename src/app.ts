import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify from "fastify";

import routes from "./api/routes/index.js";
import { AppError } from "./common/errors/AppError.js";
import type { AppLogger } from "./common/logger/logger.js";
import type { Env } from "./config/env.js";
import type { DatabaseClient } from "./database/client.js";
import type { RepositoryContainer } from "./database/repositories.js";
import type { ServiceContainer } from "./services/index.js";

export interface AppContainer {
  env: Env;
  logger: AppLogger;
  database: DatabaseClient;
  repositories: RepositoryContainer;
  services: ServiceContainer;
}

declare module "fastify" {
  interface FastifyInstance {
    container: AppContainer;
  }
}

export interface BuildAppOptions {
  env: Env;
  logger: AppLogger;
  database: DatabaseClient;
  repositories: RepositoryContainer;
  services: ServiceContainer;
}

export const buildApp = async ({
  env,
  logger,
  database,
  repositories,
  services,
}: BuildAppOptions) => {
  const app = Fastify({
    loggerInstance: logger,
  });

  app.decorate("container", {
    env,
    logger,
    database,
    repositories,
    services,
  });

  app.addHook("onClose", async () => {
    await database.close();
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: true,
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return;
    }

    logger.error({ err: error }, "Unhandled application error");
    reply.status(500).send({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    });
  });

  await app.register(routes);
  console.log("Routes registered", routes);

  return app;
};
