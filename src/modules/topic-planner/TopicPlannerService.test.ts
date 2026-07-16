import { describe, expect, it, vi } from "vitest";

import type { RepositoryContainer } from "../../database/repositories.js";
import { createTopicPlannerService } from "./TopicPlannerService.js";

describe("TopicPlannerService", () => {
  it("returns the highest-ranked valid generated topic", async () => {
    const repositories = {
      content: {
        listByProjectId: vi.fn().mockResolvedValue([]),
      },
      topicHistory: {
        listByProjectId: vi.fn().mockResolvedValue([]),
      },
    } as unknown as RepositoryContainer;
    const topicPlanner = createTopicPlannerService({
      repositories,
      searchService: {
        search: vi.fn(),
        findSimilar: vi.fn(),
      },
      logger: {
        debug: vi.fn(),
      } as never,
      contentClusterAnalyzer: {
        analyze: vi.fn().mockReturnValue([]),
      },
      gapDetector: {
        detect: vi.fn().mockReturnValue({
          existingTopics: ["Kitchen Cabinet Hardware Guide"],
          recentTopics: [],
          historicalTopics: [],
          historicalSlugs: [],
          historicalPrimaryKeywords: [],
          preferredTopics: [],
          avoidTopics: [],
          services: ["cabinet hardware"],
          audiences: ["homeowners"],
          industries: ["home services"],
          keywords: ["cabinet pulls"],
          clusters: [],
          gaps: [
            {
              clusterKey: "kitchen",
              clusterLabel: "Kitchen",
              anchor: "Cabinet Hardware",
              semanticGap: 0.9,
              businessValue: 0.8,
              seoOpportunity: 0.8,
              serviceRelevance: 0.9,
              freshness: 0.7,
              clusterDiversity: 0.4,
              publishingFrequency: 0.2,
              searchIntent: "Informational",
              businessIntent: "Evaluation",
            },
          ],
        }),
      },
      topicGenerator: {
        generateCandidates: vi.fn().mockImplementation(({ offset }) =>
          offset === 0
            ? [
                {
                  topic: "Best Kitchen Cabinet Hardware",
                  category: "Kitchen",
                  semanticUniqueness: 0.5,
                  semanticGap: 0.9,
                  businessValue: 0.8,
                  seoOpportunity: 0.8,
                  serviceRelevance: 0.7,
                  internalLinkOpportunity: 0.75,
                  clusterDiversity: 0.4,
                  freshness: 0.7,
                  recentPublishingFrequency: 0.2,
                  duplicateScore: 0,
                },
                {
                  topic: "Kitchen Cabinet Hardware Trends",
                  category: "Kitchen",
                  semanticUniqueness: 0.9,
                  semanticGap: 0.88,
                  businessValue: 0.78,
                  seoOpportunity: 0.82,
                  serviceRelevance: 0.8,
                  internalLinkOpportunity: 0.85,
                  clusterDiversity: 0.45,
                  freshness: 0.75,
                  recentPublishingFrequency: 0.15,
                  duplicateScore: 0,
                },
              ]
            : [],
        ),
      },
      duplicateDetector: {
        detect: vi.fn().mockResolvedValue({
          duplicate: false,
          duplicateScore: 0,
          matchingArticle: null,
          similarArticles: [],
        }),
      },
      topicValidator: {
        validate: vi.fn().mockImplementation(({ topic, duplicateDetection }) => ({
          valid:
            duplicateDetection === undefined ||
            topic === "Kitchen Cabinet Hardware Trends",
          slug: topic.toLowerCase().replace(/\s+/g, "-"),
          issues: topic === "Kitchen Cabinet Hardware Trends" ? [] : ["TOPIC_TOO_GENERIC"],
        })),
      },
    });

    const result = await topicPlanner.planTopic({
      projectId: "project-1",
    });

    expect(result).toEqual({
      topic: "Kitchen Cabinet Hardware Trends",
    });
  });

  it("returns null when no unique topic can be found after duplicate attempts", async () => {
    const repositories = {
      content: {
        listByProjectId: vi.fn().mockResolvedValue([]),
      },
      topicHistory: {
        listByProjectId: vi.fn().mockResolvedValue([]),
      },
    } as unknown as RepositoryContainer;
    const topicPlanner = createTopicPlannerService({
      repositories,
      searchService: {
        search: vi.fn(),
        findSimilar: vi.fn(),
      },
      logger: {
        debug: vi.fn(),
      } as never,
      contentClusterAnalyzer: {
        analyze: vi.fn().mockReturnValue([]),
      },
      gapDetector: {
        detect: vi.fn().mockReturnValue({
          existingTopics: [],
          recentTopics: [],
          historicalTopics: [],
          historicalSlugs: [],
          historicalPrimaryKeywords: [],
          preferredTopics: [],
          avoidTopics: [],
          services: ["cabinet hardware"],
          audiences: ["operations leaders"],
          industries: ["home services"],
          keywords: ["cabinet hardware"],
          clusters: [],
          gaps: Array.from({ length: 4 }, (_, index) => ({
            clusterKey: `kitchen-${index + 1}`,
            clusterLabel: "Kitchen",
            anchor: `Cabinet Hardware ${index + 1}`,
            semanticGap: 0.9,
            businessValue: 0.8,
            seoOpportunity: 0.8,
            serviceRelevance: 0.9,
            clusterDiversity: 0.5,
            freshness: 0.7,
            publishingFrequency: 0.1,
            searchIntent: "Informational",
            businessIntent: "Evaluation",
          })),
        }),
      },
      duplicateDetector: {
        detect: vi.fn().mockResolvedValue({
          duplicate: true,
          duplicateScore: 0.91,
          matchingArticle: {
            id: "content-1",
            title: "Existing",
            url: "https://example.com/existing",
            score: 0.91,
            excerpt: "Existing",
          },
          similarArticles: [],
        }),
      },
    });

    const result = await topicPlanner.planTopic({
      projectId: "project-1",
    });

    expect(result).toBeNull();
    expect(topicPlanner).toBeTruthy();
  });
});
