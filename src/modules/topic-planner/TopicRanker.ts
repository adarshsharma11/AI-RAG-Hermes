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
      candidate.semanticGap * 0.24 +
      candidate.businessValue * 0.2 +
      candidate.seoOpportunity * 0.16 +
      candidate.categoryDiversity * 0.12 +
      candidate.freshness * 0.12 +
      (1 - candidate.duplicateScore) * 0.1 +
      (1 - candidate.recentPublishingFrequency) * 0.06
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
