import { describe, expect, it, vi } from "vitest";

import type { RepositoryContainer } from "../../database/repositories.js";
import { createMemoryService } from "./MemoryService.js";

describe("MemoryService", () => {
  it("reuses cached context and returns a full planner response", async () => {
    const repositories: RepositoryContainer = {
      projects: {} as RepositoryContainer["projects"],
      sources: {} as RepositoryContainer["sources"],
      content: {} as RepositoryContainer["content"],
      contextCache: {
        findValidByHash: vi.fn().mockResolvedValue({
          id: "cache-1",
          projectId: "project-1",
          requestHash: "hash",
          response: {
            query: "Kitchen cabinet hardware",
            documents: [
              {
                id: "content-2",
                title: "Kitchen Hardware Guide",
                url: "https://example.com/hardware-guide",
                score: 0.92,
                excerpt: "Context excerpt.",
                context: "Prompt-ready context.",
              },
            ],
            totalCharacters: 400,
            generatedAt: "2026-07-14T00:00:00.000Z",
          },
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
        }),
        save: vi.fn(),
        deleteExpired: vi.fn().mockResolvedValue(0),
      },
      embeddingJobs: {} as RepositoryContainer["embeddingJobs"],
      search: {} as RepositoryContainer["search"],
      sync: {} as RepositoryContainer["sync"],
    };
    const contextService = {
      buildContext: vi.fn(),
      getMetrics: vi.fn(),
    };
    const searchService = {
      search: vi.fn().mockResolvedValue({
        items: [
          {
            id: "content-2",
            title: "Kitchen Hardware Guide",
            url: "https://example.com/hardware-guide",
            score: 0.92,
            distance: 0.08,
            excerpt: "Hardware guide excerpt.",
            metadata: {
              categories: [{ id: "1", name: "Kitchen", slug: "kitchen" }],
            },
          },
          {
            id: "content-3",
            title: "Cabinet Pull Styles",
            url: "https://example.com/cabinet-pull-styles",
            score: 0.81,
            distance: 0.19,
            excerpt: "Pull styles excerpt.",
            metadata: {
              categories: [{ id: "1", name: "Kitchen", slug: "kitchen" }],
            },
          },
        ],
        metrics: {
          averageSearchLatency: 10,
          queries: 1,
          averageSimilarity: 0.865,
          topHitScore: 0.92,
        },
      }),
      findSimilar: vi.fn().mockResolvedValue({
        items: [
          {
            id: "content-2",
            title: "Kitchen Hardware Guide",
            url: "https://example.com/hardware-guide",
            score: 0.92,
            distance: 0.08,
            excerpt: "Hardware guide excerpt.",
            metadata: {},
          },
        ],
        metrics: {
          averageSearchLatency: 5,
          queries: 1,
          averageSimilarity: 0.92,
          topHitScore: 0.92,
        },
      }),
    };
    const service = createMemoryService({
      repositories,
      searchService,
      contextService,
      logger: {
        debug: vi.fn(),
      } as unknown as Parameters<typeof createMemoryService>[0]["logger"],
      env: {
        CACHE_TTL: 3600,
        MEMORY_DEFAULT_CONTEXT: 5,
        MEMORY_MAX_CONTEXT: 10,
        MAX_CONTEXT_CHARS: 12000,
      },
    });

    const response = await service.buildMemory({
      projectId: "project-1",
      provider: "wordpress",
      task: "blog_generation",
      topic: "Kitchen cabinet hardware",
      language: "en",
      tone: "helpful",
      keywords: ["cabinet pulls", "kitchen hardware"],
      maxContextCharacters: 4000,
    });
    const metrics = service.getMetrics();

    expect(repositories.contextCache.deleteExpired).toHaveBeenCalled();
    expect(contextService.buildContext).not.toHaveBeenCalled();
    expect(repositories.contextCache.save).not.toHaveBeenCalled();
    expect(searchService.findSimilar).toHaveBeenCalled();
    expect(response).toMatchObject({
      topic: "Kitchen cabinet hardware",
      duplicate: true,
      duplicateScore: 0.92,
      recommendedCategory: {
        name: "Kitchen",
      },
      recommendedInternalLinks: [
        expect.objectContaining({
          id: "content-3",
        }),
      ],
      internalLinks: [
        expect.objectContaining({
          id: "content-3",
        }),
      ],
      recommendedKeywords: {
        slug: "kitchen-cabinet-hardware",
      },
      context: {
        totalCharacters: 400,
      },
    });
    expect(metrics).toMatchObject({
      memoryRequests: 1,
      duplicateRate: 1,
      averageContextSize: 400,
    });
  });

  it("stores context in cache on a cache miss", async () => {
    const repositories: RepositoryContainer = {
      projects: {} as RepositoryContainer["projects"],
      sources: {} as RepositoryContainer["sources"],
      content: {} as RepositoryContainer["content"],
      contextCache: {
        findValidByHash: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue({
          id: "cache-1",
          projectId: "project-1",
          requestHash: "hash",
          response: {},
          expiresAt: new Date(),
          createdAt: new Date(),
        }),
        deleteExpired: vi.fn().mockResolvedValue(0),
      },
      embeddingJobs: {} as RepositoryContainer["embeddingJobs"],
      search: {} as RepositoryContainer["search"],
      sync: {} as RepositoryContainer["sync"],
    };
    const contextService = {
      buildContext: vi.fn().mockResolvedValue({
        query: "Kitchen cabinet hardware cabinet pulls",
        documents: [],
        totalCharacters: 0,
        generatedAt: "2026-07-14T00:00:00.000Z",
      }),
      getMetrics: vi.fn(),
    };
    const searchService = {
      search: vi.fn().mockResolvedValue({
        items: [],
        metrics: {
          averageSearchLatency: 1,
          queries: 1,
          averageSimilarity: 0,
          topHitScore: 0,
        },
      }),
      findSimilar: vi.fn().mockResolvedValue({
        items: [],
        metrics: {
          averageSearchLatency: 1,
          queries: 1,
          averageSimilarity: 0,
          topHitScore: 0,
        },
      }),
    };
    const service = createMemoryService({
      repositories,
      searchService,
      contextService,
      logger: {
        debug: vi.fn(),
      } as unknown as Parameters<typeof createMemoryService>[0]["logger"],
      env: {
        CACHE_TTL: 3600,
        MEMORY_DEFAULT_CONTEXT: 5,
        MEMORY_MAX_CONTEXT: 10,
        MAX_CONTEXT_CHARS: 12000,
      },
    });

    await service.buildMemory({
      projectId: "project-1",
      provider: "wordpress",
      task: "blog_generation",
      topic: "Kitchen cabinet hardware",
      language: "en",
      tone: "helpful",
      keywords: ["cabinet pulls"],
    });

    expect(contextService.buildContext).toHaveBeenCalled();
    expect(repositories.contextCache.save).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
      }),
    );
  });

  it("uses the topic planner when topic is omitted", async () => {
    const repositories: RepositoryContainer = {
      projects: {} as RepositoryContainer["projects"],
      sources: {} as RepositoryContainer["sources"],
      content: {} as RepositoryContainer["content"],
      contextCache: {
        findValidByHash: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue({
          id: "cache-1",
          projectId: "project-1",
          requestHash: "hash",
          response: {},
          expiresAt: new Date(),
          createdAt: new Date(),
        }),
        deleteExpired: vi.fn().mockResolvedValue(0),
      },
      embeddingJobs: {} as RepositoryContainer["embeddingJobs"],
      search: {} as RepositoryContainer["search"],
      sync: {} as RepositoryContainer["sync"],
    };
    const contextService = {
      buildContext: vi.fn().mockResolvedValue({
        query: "Bathroom vanity lighting ideas",
        documents: [],
        totalCharacters: 0,
        generatedAt: "2026-07-14T00:00:00.000Z",
      }),
      getMetrics: vi.fn(),
    };
    const searchService = {
      search: vi.fn().mockResolvedValue({
        items: [],
        metrics: {
          averageSearchLatency: 1,
          queries: 1,
          averageSimilarity: 0,
          topHitScore: 0,
        },
      }),
      findSimilar: vi.fn().mockResolvedValue({
        items: [],
        metrics: {
          averageSearchLatency: 1,
          queries: 1,
          averageSimilarity: 0,
          topHitScore: 0,
        },
      }),
    };
    const topicPlannerService = {
      planTopic: vi.fn().mockResolvedValue({
        topic: "Bathroom vanity lighting ideas",
      }),
    };
    const service = createMemoryService({
      repositories,
      searchService,
      contextService,
      logger: {
        debug: vi.fn(),
      } as unknown as Parameters<typeof createMemoryService>[0]["logger"],
      env: {
        CACHE_TTL: 3600,
        MEMORY_DEFAULT_CONTEXT: 5,
        MEMORY_MAX_CONTEXT: 10,
        MAX_CONTEXT_CHARS: 12000,
      },
      topicPlannerService,
    });

    const response = await service.buildMemory({
      projectId: "project-1",
      provider: "wordpress",
      task: "blog_generation",
      language: "en",
      tone: "helpful",
      keywords: ["vanity lighting"],
    });

    expect(topicPlannerService.planTopic).toHaveBeenCalledWith({
      projectId: "project-1",
      seedKeywords: ["vanity lighting"],
    });
    expect(response.topic).toBe("Bathroom vanity lighting ideas");
    expect(contextService.buildContext).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "Bathroom vanity lighting ideas vanity lighting",
      }),
    );
  });

  it("throws NO_TOPIC_AVAILABLE when the planner cannot find a unique topic", async () => {
    const repositories: RepositoryContainer = {
      projects: {} as RepositoryContainer["projects"],
      sources: {} as RepositoryContainer["sources"],
      content: {} as RepositoryContainer["content"],
      contextCache: {
        findValidByHash: vi.fn(),
        save: vi.fn(),
        deleteExpired: vi.fn(),
      },
      embeddingJobs: {} as RepositoryContainer["embeddingJobs"],
      search: {} as RepositoryContainer["search"],
      sync: {} as RepositoryContainer["sync"],
    };
    const service = createMemoryService({
      repositories,
      searchService: {
        search: vi.fn(),
        findSimilar: vi.fn(),
      },
      contextService: {
        buildContext: vi.fn(),
        getMetrics: vi.fn(),
      },
      logger: {
        debug: vi.fn(),
      } as unknown as Parameters<typeof createMemoryService>[0]["logger"],
      env: {
        CACHE_TTL: 3600,
        MEMORY_DEFAULT_CONTEXT: 5,
        MEMORY_MAX_CONTEXT: 10,
        MAX_CONTEXT_CHARS: 12000,
      },
      topicPlannerService: {
        planTopic: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.buildMemory({
        projectId: "project-1",
        provider: "wordpress",
        task: "blog_generation",
        language: "en",
        tone: "helpful",
      }),
    ).rejects.toMatchObject({
      code: "NO_TOPIC_AVAILABLE",
    });
  });

  it("defaults language and tone when callers omit them", async () => {
    const repositories: RepositoryContainer = {
      projects: {} as RepositoryContainer["projects"],
      sources: {} as RepositoryContainer["sources"],
      content: {} as RepositoryContainer["content"],
      contextCache: {
        findValidByHash: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue({
          id: "cache-1",
          projectId: "project-1",
          requestHash: "hash",
          response: {},
          expiresAt: new Date(),
          createdAt: new Date(),
        }),
        deleteExpired: vi.fn().mockResolvedValue(0),
      },
      embeddingJobs: {} as RepositoryContainer["embeddingJobs"],
      search: {} as RepositoryContainer["search"],
      sync: {} as RepositoryContainer["sync"],
    };
    const contextService = {
      buildContext: vi.fn().mockResolvedValue({
        query: "Bathroom vanity lighting ideas",
        documents: [],
        totalCharacters: 0,
        generatedAt: "2026-07-14T00:00:00.000Z",
      }),
      getMetrics: vi.fn(),
    };
    const searchService = {
      search: vi.fn().mockResolvedValue({
        items: [],
        metrics: {
          averageSearchLatency: 1,
          queries: 1,
          averageSimilarity: 0,
          topHitScore: 0,
        },
      }),
      findSimilar: vi.fn().mockResolvedValue({
        items: [],
        metrics: {
          averageSearchLatency: 1,
          queries: 1,
          averageSimilarity: 0,
          topHitScore: 0,
        },
      }),
    };
    const generationPlanner = {
      buildPlan: vi.fn().mockReturnValue({
        topic: "Bathroom vanity lighting ideas",
        duplicate: false,
        duplicateScore: 0,
        duplicateMatch: null,
        recommendedCategory: null,
        recommendedKeywords: {
          primary: [],
          title: [],
          h2: [],
          faq: [],
          slug: "bathroom-vanity-lighting-ideas",
        },
        recommendedInternalLinks: [],
        internalLinks: [],
        context: {
          query: "Bathroom vanity lighting ideas",
          documents: [],
          totalCharacters: 0,
          generatedAt: "2026-07-14T00:00:00.000Z",
        },
        relatedArticles: [],
        warnings: [],
        generatedAt: "2026-07-14T00:00:00.000Z",
      }),
    };
    const service = createMemoryService({
      repositories,
      searchService,
      contextService,
      logger: {
        debug: vi.fn(),
      } as unknown as Parameters<typeof createMemoryService>[0]["logger"],
      env: {
        CACHE_TTL: 3600,
        MEMORY_DEFAULT_CONTEXT: 5,
        MEMORY_MAX_CONTEXT: 10,
        MAX_CONTEXT_CHARS: 12000,
      },
      topicPlannerService: {
        planTopic: vi.fn().mockResolvedValue({
          topic: "Bathroom vanity lighting ideas",
        }),
      },
      generationPlanner: generationPlanner as never,
    });

    await service.buildMemory({
      projectId: "project-1",
      provider: "wordpress",
      task: "blog_generation",
    });

    expect(generationPlanner.buildPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "en",
        tone: "professional",
      }),
    );
  });
});
