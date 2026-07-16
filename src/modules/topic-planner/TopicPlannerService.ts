import type { AppLogger } from "../../common/logger/logger.js";
import type { RepositoryContainer } from "../../database/repositories.js";
import type { ProjectProfileRecord } from "../../database/schema/index.js";
import {
  createDuplicateDetector,
  type DuplicateDetector,
} from "../memory/DuplicateDetector.js";
import type { SearchService } from "../search/search.service.js";
import {
  createContentAnglePlanner,
  type ContentAnglePlanner,
} from "./ContentAnglePlanner.js";
import {
  createContentClusterAnalyzer,
  type ContentClusterAnalyzer,
} from "./ContentClusterAnalyzer.js";
import {
  createGapDetector,
  type GapDetector,
} from "./GapDetector.js";
import {
  createSearchIntentClassifier,
  type SearchIntentClassifier,
} from "./SearchIntentClassifier.js";
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
const CANDIDATE_BATCH_SIZE = 25;

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
  contentAnglePlanner?: ContentAnglePlanner | undefined;
  contentClusterAnalyzer?: ContentClusterAnalyzer | undefined;
  gapDetector?: GapDetector | undefined;
  searchIntentClassifier?: SearchIntentClassifier | undefined;
  topicGenerator?: TopicGenerator | undefined;
  topicValidator?: TopicValidator | undefined;
  topicRanker?: TopicRanker | undefined;
}

export const createTopicPlannerService = ({
  repositories,
  searchService,
  logger,
  duplicateDetector = createDuplicateDetector({ searchService }),
  contentAnglePlanner = createContentAnglePlanner(),
  contentClusterAnalyzer = createContentClusterAnalyzer(),
  gapDetector = createGapDetector(),
  searchIntentClassifier = createSearchIntentClassifier(),
  topicGenerator = createTopicGenerator(),
  topicValidator = createTopicValidator(),
  topicRanker = createTopicRanker(),
}: CreateTopicPlannerServiceOptions): TopicPlannerService => ({
  planTopic: async ({ projectId, profile, seedKeywords = [] }) => {
    const contentItems = await repositories.content.listByProjectId(projectId);
    const topicHistory = await repositories.topicHistory.listByProjectId(projectId);
    const clusters = contentClusterAnalyzer.analyze({
      contentItems,
      topicHistory,
      profile,
      seedKeywords,
    });
    const analysis = gapDetector.detect({
      clusters,
      contentItems,
      topicHistory,
      profile,
      seedKeywords,
    });

    if (analysis.gaps.length === 0) {
      logger.debug({ projectId }, "No topic gaps available for planning");
      return null;
    }

    const anglePlans = contentAnglePlanner.plan({
      analysis,
      topicHistory,
    });

    if (anglePlans.length === 0) {
      logger.debug({ projectId }, "No content angles available for planning");
      return null;
    }

    const intentOpportunities = searchIntentClassifier.classify({
      analysis,
      anglePlans,
    });

    if (intentOpportunities.length === 0) {
      logger.debug({ projectId }, "No intent opportunities available for planning");
      return null;
    }

    let offset = 0;
    let duplicateAttempts = 0;

    while (duplicateAttempts < MAX_DUPLICATE_ATTEMPTS) {
      const candidates = topicRanker.rankCandidates(
        topicGenerator.generateCandidates({
          analysis,
          intentOpportunities,
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
          historicalTopics: analysis.historicalTopics,
          historicalPrimaryKeywords: analysis.historicalPrimaryKeywords,
          historicalSlugs: analysis.historicalSlugs,
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
          historicalTopics: analysis.historicalTopics,
          historicalPrimaryKeywords: analysis.historicalPrimaryKeywords,
          historicalSlugs: analysis.historicalSlugs,
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
            service: candidate.service,
            contentAngle: candidate.contentAngle,
            titlePattern: candidate.titlePattern,
            searchIntent: candidate.searchIntent,
            searchDemand: candidate.searchDemand,
            semanticUniqueness: candidate.semanticUniqueness,
            businessValue: candidate.businessValue,
            conversionPotential: candidate.conversionPotential,
            internalLinkOpportunity: candidate.internalLinkOpportunity,
            topicalAuthority: candidate.topicalAuthority,
            editorialDiversity: candidate.editorialDiversity,
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
