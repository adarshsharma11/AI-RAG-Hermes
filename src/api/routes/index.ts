import type { FastifyPluginAsync } from "fastify";

import { contentRoutes } from "./content.js";
import { contextRoutes } from "./context.js";
import { embeddingRoutes } from "./embeddings.js";
import { healthRoutes } from "./health.js";
import { importRoutes } from "./import.js";
import { memoryRoutes } from "./memory.js";
import { searchRoutes } from "./search.js";
import { syncRoutes } from "./sync.js";

const routes: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes);
  await app.register(contextRoutes);
  await app.register(embeddingRoutes);
  await app.register(importRoutes);
  await app.register(memoryRoutes);
  await app.register(searchRoutes);
  await app.register(syncRoutes);
  await app.register(contentRoutes);
};

export default routes;
