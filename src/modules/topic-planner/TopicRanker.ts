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
      candidate.searchDemand * 0.25 +
      candidate.businessValue * 0.22 +
      candidate.semanticUniqueness * 0.19 +
      candidate.conversionPotential * 0.15 +
      candidate.internalLinkOpportunity * 0.1 +
      candidate.topicalAuthority * 0.09
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
