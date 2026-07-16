import type { TopicCandidate } from "./TopicGenerator.js";

export interface RankedTopicCandidate extends TopicCandidate {
  totalScore: number;
}

export interface TopicRanker {
  rankCandidates(candidates: TopicCandidate[]): RankedTopicCandidate[];
}

const scoreCandidate = (candidate: TopicCandidate): number =>
  Number(
    (
      candidate.semanticUniqueness * 0.22 +
      (1 - candidate.duplicateScore) * 0.18 +
      candidate.seoOpportunity * 0.15 +
      candidate.businessValue * 0.14 +
      candidate.serviceRelevance * 0.12 +
      candidate.internalLinkOpportunity * 0.08 +
      candidate.freshness * 0.04 +
      (1 - candidate.recentPublishingFrequency) * 0.03 +
      candidate.semanticGap * 0.03 +
      candidate.categoryDiversity * 0.01
    ).toFixed(6),
  );

export const createTopicRanker = (): TopicRanker => ({
  rankCandidates: (candidates) =>
    candidates
      .map((candidate) => ({
        ...candidate,
        totalScore: scoreCandidate(candidate),
      }))
      .sort((left, right) => right.totalScore - left.totalScore),
});
