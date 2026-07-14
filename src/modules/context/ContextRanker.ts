import {
  getPublishedStatus,
  getPublishedTimestamp,
  normalizeText,
} from "./ContextFilters.js";
import type { ContextChunkCandidate } from "./ContextAssembler.js";

export interface RankedContextCandidate extends ContextChunkCandidate {
  rankScore: number;
}

const normalizeFreshness = (publishedAt: Date | null): number => {
  if (!publishedAt) {
    return 0.4;
  }

  const ageInMs = Date.now() - publishedAt.getTime();
  const ageInDays = Math.max(0, ageInMs / (1000 * 60 * 60 * 24));

  return 1 / (1 + ageInDays / 30);
};

const normalizeContentLength = (wordCount: number): number => {
  if (wordCount >= 500 && wordCount <= 800) {
    return 1;
  }

  const distance = Math.abs(wordCount - 650);
  return Math.max(0, 1 - distance / 650);
};

const normalizePublishedStatus = (candidate: ContextChunkCandidate): number => {
  const metadataStatus = getPublishedStatus(candidate.metadata);

  if (metadataStatus === "publish") {
    return 1;
  }

  if (metadataStatus === "draft" || metadataStatus === "private") {
    return 0.25;
  }

  return 0.7;
};

const normalizeExactKeywordMatch = (
  candidate: ContextChunkCandidate,
  query: string,
  keywords: readonly string[],
): number => {
  const haystack = normalizeText(
    `${candidate.title ?? ""} ${candidate.excerpt} ${candidate.context}`,
  );
  const phrase = normalizeText(query);
  const phraseMatch = phrase.length > 0 && haystack.includes(phrase) ? 1 : 0;
  const keywordSignal =
    keywords.length === 0
      ? 0
      : Math.min(1, candidate.exactKeywordMatches / keywords.length);

  return Math.max(phraseMatch, Math.max(candidate.keywordCoverage, keywordSignal));
};

export const rankContextCandidates = (
  candidates: readonly ContextChunkCandidate[],
  input: { query: string; keywords: readonly string[] },
): RankedContextCandidate[] =>
  [...candidates]
    .map((candidate): RankedContextCandidate => {
      const freshness = normalizeFreshness(getPublishedTimestamp(candidate.metadata));
      const contentLength = normalizeContentLength(candidate.wordCount);
      const publishedStatus = normalizePublishedStatus(candidate);
      const exactKeywordMatch = normalizeExactKeywordMatch(
        candidate,
        input.query,
        input.keywords,
      );
      const rankScore =
        candidate.score * 0.55 +
        freshness * 0.15 +
        contentLength * 0.1 +
        publishedStatus * 0.1 +
        exactKeywordMatch * 0.1;

      return {
        ...candidate,
        rankScore,
      };
    })
    .sort((left, right) => {
      if (right.rankScore !== left.rankScore) {
        return right.rankScore - left.rankScore;
      }

      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const rightPublished = getPublishedTimestamp(right.metadata)?.getTime() ?? 0;
      const leftPublished = getPublishedTimestamp(left.metadata)?.getTime() ?? 0;

      return rightPublished - leftPublished;
    });
