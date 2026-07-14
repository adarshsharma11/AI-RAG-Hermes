export const APP_NAME = "ai-memory";

export const SOURCE_TYPES = [
  "wordpress",
  "shopify",
  "linkedin",
  "markdown",
  "pdf",
  "knowledge_base",
  "agent",
] as const;

export const SOURCE_STATUSES = [
  "pending",
  "active",
  "paused",
  "archived",
] as const;

export const CONTENT_ITEM_STATUSES = [
  "ACTIVE",
  "UPDATED",
  "DELETED",
  "PENDING_EMBEDDING",
] as const;

export const SYNC_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;

export const EMBEDDING_JOB_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
] as const;
