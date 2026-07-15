import type { AppLogger } from "../../common/logger/logger.js";
import type { RepositoryContainer } from "../../database/repositories.js";
import type { ProjectProfileRecord } from "../../database/schema/index.js";
import {
  createDuplicateDetector,
  type DuplicateDetector,
} from "../memory/DuplicateDetector.js";
import type { SearchService } from "../search/search.service.js";
import {
  createTopicGapAnalyzer,
  type TopicGapAnalyzer,
} from "./TopicGapAnalyzer.js";
import {
  createTopicGenerator,
  type TopicCandidate,
  type TopicGenerator,
} from "./TopicGenerator.js";
import {
  createTopicRanker,
  type RankedTopicCandidate,
  type TopicRanker,
} from "./TopicRanker.js";
import {
  createTopicValidator,
  type TopicValidator,
} from "./TopicValidator.js";

const MAX_DUPLICATE_ATTEMPTS = 20;
const CANDIDATE_BATCH_SIZE = 10;

export interface TopicPlannerResult {
  topic: string;
}

export interface TopicPlannerService {
  planTopic(input: {
    projectId: string;
    profile?: ProjectProfileRecord | null | undefined;
    seedKeywords?: string[] | undefined;
  }): Promise<TopicPlannerResult | null>;
}

export interface CreateTopicPlannerServiceOptions {
  repositories: RepositoryContainer;
  searchService: SearchService;
  logger: AppLogger;
  duplicateDetector?: DuplicateDetector | undefined;
  topicGapAnalyzer?: TopicGapAnalyzer | undefined;
  topicGenerator?: TopicGenerator | undefined;
  topicValidator?: TopicValidator | undefined;
  topicRanker?: TopicRanker | undefined;
}

export const createTopicPlannerService = ({
  repositories,
  searchService,
  logger,
  duplicateDetector = createDuplicateDetector({ searchService }),
  topicGapAnalyzer = createTopicGapAnalyzer(),
  topicGenerator = createTopicGenerator(),
  topicValidator = createTopicValidator(),
  topicRanker = createTopicRanker(),
}: CreateTopicPlannerServiceOptions): TopicPlannerService => ({
  planTopic: async ({ projectId, profile, seedKeywords = [] }) => {
    const contentItems = await repositories.content.listByProjectId(projectId);
    const analysis = topicGapAnalyzer.analyze({
      contentItems,
      profile,
      seedKeywords,
    });

    if (analysis.highValueGaps.length === 0) {
      logger.debug({ projectId }, "No topic gaps available for planning");
      return null;
    }

    let offset = 0;
    let duplicateAttempts = 0;

    while (duplicateAttempts < MAX_DUPLICATE_ATTEMPTS) {
      const candidates = topicRanker.rankCandidates(
        topicGenerator.generateCandidates({
          analysis,
          seedKeywords,
          limit: CANDIDATE_BATCH_SIZE,
          offset,
        }),
      );

      if (candidates.length === 0) {
        break;
      }

      const validCandidates: RankedTopicCandidate[] = [];

      for (const candidate of candidates) {
        if (duplicateAttempts >= MAX_DUPLICATE_ATTEMPTS) {
          break;
        }

        const staticValidation = topicValidator.validate({
          topic: candidate.topic,
          existingTopics: analysis.existingTopics,
        });

        if (!staticValidation.valid) {
          continue;
        }

        const duplicateDetection = await duplicateDetector.detect({
          projectId,
          text: candidate.topic,
        });

        duplicateAttempts += 1;

        const validation = topicValidator.validate({
          topic: candidate.topic,
          existingTopics: analysis.existingTopics,
          duplicateDetection,
        });

        if (!validation.valid) {
          continue;
        }

        validCandidates.push({
          ...candidate,
          duplicateScore: duplicateDetection.duplicateScore,
          totalScore: candidate.totalScore,
        });
      }

      const winner = topicRanker.rankCandidates(
        validCandidates.map(
          (candidate): TopicCandidate => ({
            topic: candidate.topic,
            category: candidate.category,
            semanticGap: candidate.semanticGap,
            businessValue: candidate.businessValue,
            seoOpportunity: candidate.seoOpportunity,
            categoryDiversity: candidate.categoryDiversity,
            freshness: candidate.freshness,
            recentPublishingFrequency: candidate.recentPublishingFrequency,
            duplicateScore: candidate.duplicateScore,
          }),
        ),
      )[0];

      if (winner) {
        logger.debug(
          {
            projectId,
            selectedTopic: winner.topic,
            attempts: duplicateAttempts,
          },
          "Autonomous topic selected",
        );

        return {
          topic: winner.topic,
        };
      }

      offset += candidates.length;
    }

    logger.debug(
      {
        projectId,
        attempts: duplicateAttempts,
      },
      "No unique topic available after duplicate checks",
    );

    return null;
  },
});
