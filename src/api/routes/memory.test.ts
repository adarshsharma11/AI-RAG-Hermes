import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import { createLogger } from "../../common/logger/logger.js";
import type { Env } from "../../config/env.js";
import type { DatabaseClient } from "../../database/client.js";
import type { RepositoryContainer } from "../../database/repositories.js";
import type { ServiceContainer } from "../../services/index.js";

const testEnv: Env = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 4000,
  DATABASE_URL: "postgres://user:password@localhost:5432/ai_memory",
  LOG_LEVEL: "silent",
  WORDPRESS_TIMEOUT: 5000,
  WORDPRESS_PAGE_SIZE: 10,
  IMPORT_BATCH_SIZE: 2,
  EMBEDDING_BATCH_SIZE: 2,
  EMBEDDING_CONCURRENCY: 1,
  EMBEDDING_MODEL: "nomic-embed-text",
  OLLAMA_URL: "http://127.0.0.1:11434",
  OLLAMA_TIMEOUT: 5000,
  SEARCH_DEFAULT_LIMIT: 10,
  SEARCH_MAX_LIMIT: 50,
  SIMILARITY_THRESHOLD: 0.85,
  MAX_CONTEXT_CHARS: 12000,
  DEFAULT_CONTEXT_RESULTS: 50,
  MAX_CONTEXT_RESULTS: 50,
  CACHE_TTL: 3600,
  MEMORY_DEFAULT_CONTEXT: 5,
  MEMORY_MAX_CONTEXT: 10,
};

const databaseStub: DatabaseClient = {
  db: {} as DatabaseClient["db"],
  sql: {} as DatabaseClient["sql"],
  ping: async () => undefined,
  close: async () => undefined,
};

const repositoriesStub = {} as RepositoryContainer;
let app: Awaited<ReturnType<typeof buildApp>> | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

describe("memory routes", () => {
  it("builds a memory response", async () => {
    const buildMemory = vi.fn().mockResolvedValue({
      topic: "Kitchen cabinet hardware",
      duplicate: false,
      duplicateScore: 0,
      duplicateMatch: null,
      generationBrief: {
        objective: "Educate business leaders",
        audience: "Business Owners, Founders, Executives",
        tone: "Professional",
        language: "English",
        wordCount: "1000-1200",
      },
      recommendedCategory: {
        id: "1",
        name: "Kitchen",
        slug: "kitchen",
        confidence: 0.8,
      },
      recommendedKeywords: {
        primary: ["kitchen cabinet hardware"],
        title: ["kitchen cabinet hardware"],
        h2: ["cabinet pulls"],
        faq: ["what cabinet hardware to choose"],
        slug: "kitchen-cabinet-hardware",
      },
      recommendedInternalLinks: [
        {
          id: "link-1",
          title: "Cabinet Pull Placement Guide",
          url: "https://example.com/pulls",
          score: 0.93,
          excerpt: "How to place cabinet pulls.",
          category: "Kitchen",
        },
        {
          id: "link-2",
          title: "Kitchen Hardware Finishes",
          url: "https://example.com/finishes",
          score: 0.88,
          excerpt: "Finishes for kitchens.",
          category: "Kitchen",
        },
        {
          id: "link-3",
          title: "Knob vs Pull Comparison",
          url: "https://example.com/comparison",
          score: 0.84,
          excerpt: "Knobs and pulls compared.",
          category: "Kitchen",
        },
        {
          id: "link-4",
          title: "Old Link",
          url: "https://example.com/old-link",
          score: 0.8,
          excerpt: "Extra link.",
          category: "Kitchen",
        },
      ],
      internalLinks: [],
      seo: {
        title: "Kitchen Cabinet Hardware: What Homeowners Need to Know",
        slug: "kitchen-cabinet-hardware-what-homeowners-need-to-know",
        metaTitle: "Kitchen Cabinet Hardware Guide",
        metaDescription: "Learn how to choose kitchen cabinet hardware with practical guidance for style, function, and installation.",
        primaryKeyword: "Kitchen Cabinet Hardware Guide",
        secondaryKeywords: ["Kitchen Cabinet Pull Placement", "Best Kitchen Cabinet Hardware Finishes"],
        faqKeywords: ["How Do You Choose Kitchen Cabinet Hardware", "What Cabinet Hardware Lasts Longest"],
        searchIntent: "Informational",
      },
      outline: [
        {
          heading: "What Needs To Be In Place Before Choosing Kitchen Cabinet Hardware",
          subheadings: [
            "- Match the finish to the room",
            "2. Pick the right size",
          ],
        },
        {
          heading: "Why Cabinet Hardware Matters for Long-Term Durability",
          subheadings: [
            "Durability",
          ],
        },
        {
          heading: "How To Measure Cabinet Hardware Success",
          subheadings: [
            "Track installation quality",
          ],
        },
      ],
      context: {
        query: "Kitchen cabinet hardware",
        documents: [
          {
            id: "doc-1",
            title: "Cabinet Hardware Basics",
            url: "https://example.com/basics",
            score: 0.91,
            excerpt:
              "Kitchen cabinet hardware influences layout, usability, style cohesion, cleaning routines, and long-term satisfaction across the entire kitchen. Homeowners often underestimate how much pull placement, finish selection, and hardware durability affect the day-to-day experience of opening drawers, maintaining alignment, and preserving the overall design language of the space during a renovation or refresh.",
            context:
              "The most successful projects align cabinet hardware choice with door style, appliance finish, traffic flow, and grip comfort so the finished kitchen feels intentional rather than patched together.",
          },
          {
            id: "doc-2",
            title: "Cabinet Pull Placement",
            url: "https://example.com/placement",
            score: 0.9,
            excerpt:
              "Placement standards make cabinet hardware easier to use and more visually consistent. Installers generally work from repeatable measurements so every door and drawer line stays clean, balanced, and ergonomic across the room.",
            context:
              "When teams standardize placement before drilling, they reduce rework, avoid crooked installs, and preserve the intended reveal lines between doors and drawers.",
          },
          {
            id: "doc-3",
            title: "Choosing Durable Finishes",
            url: "https://example.com/finishes-guide",
            score: 0.88,
            excerpt:
              "Finish durability matters in kitchens because oils, moisture, frequent touch points, and cleaning chemicals quickly reveal weak coatings. Homeowners should compare maintenance needs, scratch resistance, and how each finish ages under daily use.",
            context:
              "Brushed and matte finishes often hide fingerprints better than polished surfaces, but design fit and maintenance expectations still need to be weighed together.",
          },
          {
            id: "doc-4",
            title: "Extra Context Doc",
            url: "https://example.com/extra-context",
            score: 0.7,
            excerpt:
              "This document should be removed because only the top three context documents should be serialized.",
            context:
              "Extra context should not appear in the API payload.",
          },
        ],
        totalCharacters: 4200,
        generatedAt: "2026-07-14T00:00:00.000Z",
      },
      relatedArticles: [
        {
          id: "article-1",
          title: "Kitchen Hardware Trends",
          url: "https://example.com/trends",
          score: 0.82,
          excerpt: "Trends in cabinet hardware.",
          category: "Kitchen",
          publishedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "article-2",
          title: "Modern Cabinet Pulls",
          url: "https://example.com/modern-pulls",
          score: 0.79,
          excerpt: "Modern pull options.",
          category: "Kitchen",
          publishedAt: "2025-11-10T00:00:00.000Z",
        },
        {
          id: "article-3",
          title: "Brass Hardware Ideas",
          url: "https://example.com/brass",
          score: 0.77,
          excerpt: "Brass hardware inspiration.",
          category: "Kitchen",
          publishedAt: "2025-08-05T00:00:00.000Z",
        },
        {
          id: "article-4",
          title: "Cabinet Knob Placement",
          url: "https://example.com/knobs",
          score: 0.73,
          excerpt: "Knob placement tips.",
          category: "Kitchen",
          publishedAt: "2025-05-14T00:00:00.000Z",
        },
        {
          id: "article-5",
          title: "Hardware Finish Guide",
          url: "https://example.com/finish-guide",
          score: 0.7,
          excerpt: "Guide to finishes.",
          category: "Kitchen",
          publishedAt: "2025-03-01T00:00:00.000Z",
        },
        {
          id: "article-6",
          title: "Extra Article",
          url: "https://example.com/extra",
          score: 0.65,
          excerpt: "Should be truncated.",
          category: "Kitchen",
          publishedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
      warnings: [
        {
          code: "PLANNER_PROFILE",
          message: "Planned for task=blog_generation, provider=wordpress, language=en, tone=helpful.",
        },
      ],
      generatedAt: "2026-07-14T00:00:00.000Z",
    });
    const servicesStub: ServiceContainer = {
      imports: {
        importProject: vi.fn(),
      },
      content: {
        listContent: vi.fn(),
        getContentById: vi.fn(),
      },
      context: {
        buildContext: vi.fn(),
        getMetrics: vi.fn(),
      },
      embeddings: {
        listJobs: vi.fn(),
        getJobById: vi.fn(),
        runPendingJobs: vi.fn(),
        retryFailedJobs: vi.fn(),
      },
      memory: {
        buildMemory,
        getMetrics: vi.fn(),
      },
      projectProfiles: {
        getProfileByProjectId: vi.fn(),
        createProfile: vi.fn(),
        updateProfile: vi.fn(),
        deleteProfile: vi.fn(),
      },
      syncs: {
        syncProject: vi.fn(),
        getSyncHistory: vi.fn(),
      },
      search: {
        search: vi.fn(),
        findSimilar: vi.fn(),
      },
    };

    app = await buildApp({
      env: testEnv,
      logger: createLogger({
        level: "silent",
        environment: "test",
      }),
      database: databaseStub,
      repositories: repositoriesStub,
      services: servicesStub,
    });

    const response = await app.inject({
      method: "POST",
      url: "/memory",
      payload: {
        projectId: "0f24c4b6-3f76-4d95-8345-03b8520b6612",
        provider: "wordpress",
        task: "blog_generation",
        topic: "Kitchen cabinet hardware",
        language: "en",
        tone: "helpful",
        keywords: ["cabinet pulls"],
        maxContextCharacters: 10000,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(buildMemory).toHaveBeenCalledWith({
      projectId: "0f24c4b6-3f76-4d95-8345-03b8520b6612",
      provider: "wordpress",
      task: "blog_generation",
      topic: "Kitchen cabinet hardware",
      language: "en",
      tone: "helpful",
      keywords: ["cabinet pulls"],
      maxContextCharacters: 10000,
    });
    const payload = response.json();
    expect(payload).toMatchObject({
      topic: "Kitchen cabinet hardware",
      duplicate: false,
      generationBrief: {
        wordCount: "1000-1200",
      },
      seo: {
        title: "Kitchen Cabinet Hardware: What Homeowners Need to Know",
        slug: "kitchen-cabinet-hardware-what-homeowners-need-to-know",
        metaTitle: "Kitchen Cabinet Hardware Guide",
        metaDescription:
          "Learn how to choose kitchen cabinet hardware with practical guidance for style, function, and installation.",
        primaryKeyword: "Kitchen Cabinet Hardware Guide",
        secondaryKeywords: [
          "Kitchen Cabinet Pull Placement",
          "Best Kitchen Cabinet Hardware Finishes",
        ],
        faqKeywords: [
          "How Do You Choose Kitchen Cabinet Hardware",
          "What Cabinet Hardware Lasts Longest",
        ],
      },
      recommendedCategory: {
        name: "Kitchen",
      },
      recommendedInternalLinks: [
        {
          title: "Cabinet Pull Placement Guide",
          url: "https://example.com/pulls",
          anchorText: "Cabinet Pull Placement Guide",
        },
        {
          title: "Kitchen Hardware Finishes",
          url: "https://example.com/finishes",
          anchorText: "Kitchen Hardware Finishes",
        },
        {
          title: "Knob vs Pull Comparison",
          url: "https://example.com/comparison",
          anchorText: "Knob vs Pull Comparison",
        },
      ],
      outline: [
        {
          title: "Introduction",
          points: [],
        },
        {
          title: "Why It Matters",
          points: [],
        },
        {
          title: "Measuring Success",
          points: [],
        },
      ],
      context: {
        documents: [
          {
            title: "Cabinet Hardware Basics",
            url: "https://example.com/basics",
            excerpt:
              "Kitchen cabinet hardware influences layout, usability, style cohesion, cleaning routines, and long-term satisfaction across the entire kitchen. Homeowners often underestimate how much pull placement, finish selection, and hardware durability affect the day-to-day experience of opening drawers, maintaining alignment, and preserving the overall design language of the space during a renovation or refresh.",
          },
          {
            title: "Cabinet Pull Placement",
            url: "https://example.com/placement",
            excerpt:
              "Placement standards make cabinet hardware easier to use and more visually consistent. Installers generally work from repeatable measurements so every door and drawer line stays clean, balanced, and ergonomic across the room. When teams standardize placement before drilling, they reduce rework, avoid crooked installs, and preserve the intended reveal lines between doors and drawers.",
          },
          {
            title: "Choosing Durable Finishes",
            url: "https://example.com/finishes-guide",
            excerpt:
              "Finish durability matters in kitchens because oils, moisture, frequent touch points, and cleaning chemicals quickly reveal weak coatings. Homeowners should compare maintenance needs, scratch resistance, and how each finish ages under daily use. Brushed and matte finishes often hide fingerprints better than polished surfaces, but design fit and maintenance expectations still need to be weighed together.",
          },
        ],
        totalCharacters: expect.any(Number),
      },
      warnings: [],
    });
    expect(payload.relatedArticles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Kitchen Hardware Trends",
          url: "https://example.com/trends",
          category: "Kitchen",
          publishedAt: "2026-01-01T00:00:00.000Z",
        }),
      ]),
    );
    expect(payload).not.toHaveProperty("duplicateScore");
    expect(payload).not.toHaveProperty("duplicateMatch");
    expect(payload).not.toHaveProperty("recommendedKeywords");
    expect(payload).not.toHaveProperty("internalLinks");
    expect(payload).not.toHaveProperty("generatedAt");
    expect(payload.recommendedInternalLinks).toHaveLength(3);
    expect(payload.relatedArticles).toHaveLength(5);
    expect(payload.outline).toHaveLength(3);
    expect(payload.context.documents[0]).not.toHaveProperty("score");
    expect(payload.context.documents[0]).not.toHaveProperty("id");
    expect(payload.context.documents[0]).not.toHaveProperty("context");
    expect(payload.context).not.toHaveProperty("generatedAt");
    expect(payload.context).not.toHaveProperty("query");
    expect(payload.context.documents).toHaveLength(3);
    expect(payload.context.totalCharacters).toBeLessThanOrEqual(2500);
    expect(payload.seo).not.toHaveProperty("searchIntent");
    expect(JSON.stringify(payload).length).toBeLessThan(10_000);
  });

  it("accepts requests without topic, language, or tone and applies defaults", async () => {
    const buildMemory = vi.fn().mockResolvedValue({
      topic: "Bathroom vanity lighting ideas",
      duplicate: false,
      duplicateScore: 0,
      duplicateMatch: null,
      generationBrief: {
        objective: "Educate business leaders",
        audience: "Business Owners, Founders, Executives",
        tone: "Professional",
        language: "English",
        wordCount: "1000-1200",
      },
      recommendedCategory: null,
      recommendedKeywords: {
        primary: ["bathroom vanity lighting ideas"],
        title: ["bathroom vanity lighting ideas"],
        h2: ["vanity lighting"],
        faq: ["best vanity lighting"],
        slug: "bathroom-vanity-lighting-ideas",
      },
      recommendedInternalLinks: [],
      internalLinks: [],
      seo: {
        title: "Bathroom Vanity Lighting Ideas",
        slug: "bathroom-vanity-lighting-ideas",
        metaTitle: "Bathroom Vanity Lighting Ideas",
        metaDescription: "Bathroom vanity lighting ideas for remodel planning.",
        primaryKeyword: "Bathroom Vanity Lighting Ideas",
        secondaryKeywords: ["Vanity Lighting Ideas"],
        faqKeywords: ["How To Choose Bathroom Vanity Lighting"],
        searchIntent: "Informational",
      },
      outline: [],
      context: {
        query: "Bathroom vanity lighting ideas",
        documents: [],
        totalCharacters: 0,
        generatedAt: "2026-07-14T00:00:00.000Z",
      },
      relatedArticles: [],
      warnings: [],
      generatedAt: "2026-07-14T00:00:00.000Z",
    });
    const servicesStub: ServiceContainer = {
      imports: {
        importProject: vi.fn(),
      },
      content: {
        listContent: vi.fn(),
        getContentById: vi.fn(),
      },
      context: {
        buildContext: vi.fn(),
        getMetrics: vi.fn(),
      },
      embeddings: {
        listJobs: vi.fn(),
        getJobById: vi.fn(),
        runPendingJobs: vi.fn(),
        retryFailedJobs: vi.fn(),
      },
      memory: {
        buildMemory,
        getMetrics: vi.fn(),
      },
      projectProfiles: {
        getProfileByProjectId: vi.fn(),
        createProfile: vi.fn(),
        updateProfile: vi.fn(),
        deleteProfile: vi.fn(),
      },
      syncs: {
        syncProject: vi.fn(),
        getSyncHistory: vi.fn(),
      },
      search: {
        search: vi.fn(),
        findSimilar: vi.fn(),
      },
    };

    app = await buildApp({
      env: testEnv,
      logger: createLogger({
        level: "silent",
        environment: "test",
      }),
      database: databaseStub,
      repositories: repositoriesStub,
      services: servicesStub,
    });

    const response = await app.inject({
      method: "POST",
      url: "/memory",
      payload: {
        projectId: "0f24c4b6-3f76-4d95-8345-03b8520b6612",
        provider: "wordpress",
        task: "blog_generation",
        keywords: ["vanity lighting"],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(buildMemory).toHaveBeenCalledWith({
      projectId: "0f24c4b6-3f76-4d95-8345-03b8520b6612",
      provider: "wordpress",
      task: "blog_generation",
      language: "en",
      tone: "professional",
      keywords: ["vanity lighting"],
    });
    expect(response.json()).toMatchObject({
      topic: "Bathroom vanity lighting ideas",
      generationBrief: {
        language: "English",
        tone: "Professional",
      },
      seo: {
        primaryKeyword: "Bathroom Vanity Lighting Ideas",
      },
      context: {
        documents: [],
        totalCharacters: 0,
      },
      warnings: [],
    });
  });

  it("validates bad memory requests", async () => {
    const servicesStub: ServiceContainer = {
      imports: {
        importProject: vi.fn(),
      },
      content: {
        listContent: vi.fn(),
        getContentById: vi.fn(),
      },
      context: {
        buildContext: vi.fn(),
        getMetrics: vi.fn(),
      },
      embeddings: {
        listJobs: vi.fn(),
        getJobById: vi.fn(),
        runPendingJobs: vi.fn(),
        retryFailedJobs: vi.fn(),
      },
      memory: {
        buildMemory: vi.fn(),
        getMetrics: vi.fn(),
      },
      projectProfiles: {
        getProfileByProjectId: vi.fn(),
        createProfile: vi.fn(),
        updateProfile: vi.fn(),
        deleteProfile: vi.fn(),
      },
      syncs: {
        syncProject: vi.fn(),
        getSyncHistory: vi.fn(),
      },
      search: {
        search: vi.fn(),
        findSimilar: vi.fn(),
      },
    };

    app = await buildApp({
      env: testEnv,
      logger: createLogger({
        level: "silent",
        environment: "test",
      }),
      database: databaseStub,
      repositories: repositoriesStub,
      services: servicesStub,
    });

    const response = await app.inject({
      method: "POST",
      url: "/memory",
      payload: {
        projectId: "bad-id",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "INVALID_MEMORY_BODY",
    });
  });
});
