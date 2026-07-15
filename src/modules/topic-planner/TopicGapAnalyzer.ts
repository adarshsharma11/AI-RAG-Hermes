import type { ContentItemRecord } from "../../database/schema/index.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "best",
  "by",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "your",
]);

const HIGH_VALUE_TERMS = new Set([
  "best",
  "cost",
  "design",
  "guide",
  "ideas",
  "mistakes",
  "tips",
  "trends",
  "vs",
]);

interface CategoryStats {
  name: string;
  totalCount: number;
  recentCount: number;
  staleCount: number;
  keywordCounts: Map<string, number>;
  recentKeywordCounts: Map<string, number>;
}

export interface TopicGapSeed {
  category: string | null;
  keyword: string;
  semanticGap: number;
  businessValue: number;
  seoOpportunity: number;
  categoryDiversity: number;
  freshness: number;
  recentPublishingFrequency: number;
}

export interface TopicGapAnalysis {
  existingTopics: string[];
  recentTopics: string[];
  overWrittenTopics: string[];
  underWrittenTopics: string[];
  missingClusters: string[];
  staleContent: string[];
  highValueGaps: TopicGapSeed[];
}

export interface TopicGapAnalyzer {
  analyze(input: {
    contentItems: ContentItemRecord[];
    seedKeywords?: string[] | undefined;
  }): TopicGapAnalysis;
}

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (value: string): string =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const extractTaxonomyNames = (
  value: unknown,
  field: "name" | "slug" = "name",
): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const candidate = entry[field];
      return typeof candidate === "string" ? candidate.trim() : null;
    })
    .filter((entry): entry is string => Boolean(entry));
};

const extractPublishedAt = (contentItem: ContentItemRecord): Date => {
  const metadata = contentItem.metadata;
  const publishedAt = metadata.publishedAt ?? metadata.published_at;
  const modifiedAt = metadata.modifiedAt ?? metadata.modified_at;

  for (const value of [publishedAt, modifiedAt]) {
    if (typeof value !== "string") {
      continue;
    }

    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return contentItem.createdAt;
};

const tokenize = (value: string): string[] =>
  normalizeText(value)
    .split(" ")
    .filter(
      (part) =>
        part.length >= 3 &&
        !STOP_WORDS.has(part),
    );

const buildKeywordPhrases = (
  title: string,
  categories: string[],
  tags: string[],
  seedKeywords: readonly string[],
): string[] => {
  const titleTokens = tokenize(title);
  const categoryTokens = new Set(categories.flatMap((category) => tokenize(category)));
  const phrases = new Set<string>();

  for (const tag of tags) {
    const normalized = normalizeText(tag);

    if (normalized.length >= 4) {
      phrases.add(normalized);
    }
  }

  for (const keyword of seedKeywords) {
    const normalized = normalizeText(keyword);

    if (normalized.length >= 4) {
      phrases.add(normalized);
    }
  }

  for (let index = 0; index < titleTokens.length; index += 1) {
    const token = titleTokens[index]!;

    if (!categoryTokens.has(token)) {
      phrases.add(token);
    }

    const next = titleTokens[index + 1];

    if (
      next &&
      !categoryTokens.has(token) &&
      !categoryTokens.has(next)
    ) {
      phrases.add(`${token} ${next}`);
    }
  }

  return [...phrases];
};

const incrementMap = (map: Map<string, number>, key: string): void => {
  map.set(key, (map.get(key) ?? 0) + 1);
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const createTopicGapAnalyzer = (): TopicGapAnalyzer => ({
  analyze: ({ contentItems, seedKeywords = [] }) => {
    const now = Date.now();
    const recentThreshold = now - 1000 * 60 * 60 * 24 * 90;
    const staleThreshold = now - 1000 * 60 * 60 * 24 * 180;
    const categoryStats = new Map<string, CategoryStats>();
    const existingTopics = contentItems
      .map((contentItem) => contentItem.title?.trim() ?? "")
      .filter(Boolean);
    const recentTopics: string[] = [];
    const staleContent = new Set<string>();

    for (const contentItem of contentItems) {
      const title = contentItem.title?.trim();

      if (!title) {
        continue;
      }

      const metadata = contentItem.metadata;
      const categories = extractTaxonomyNames(metadata.categories);
      const tags = extractTaxonomyNames(metadata.tags);
      const publishedAt = extractPublishedAt(contentItem);
      const isRecent = publishedAt.getTime() >= recentThreshold;
      const isStale = publishedAt.getTime() < staleThreshold;
      const bucketCategories = categories.length > 0 ? categories : ["General"];
      const keywords = buildKeywordPhrases(title, bucketCategories, tags, seedKeywords);

      if (isRecent) {
        recentTopics.push(title);
      }

      if (isStale) {
        staleContent.add(title);
      }

      for (const category of bucketCategories) {
        const key = normalizeText(category);
        const stats = categoryStats.get(key) ?? {
          name: titleCase(normalizeText(category)),
          totalCount: 0,
          recentCount: 0,
          staleCount: 0,
          keywordCounts: new Map<string, number>(),
          recentKeywordCounts: new Map<string, number>(),
        };

        stats.totalCount += 1;

        if (isRecent) {
          stats.recentCount += 1;
        }

        if (isStale) {
          stats.staleCount += 1;
        }

        for (const keyword of keywords) {
          incrementMap(stats.keywordCounts, keyword);

          if (isRecent) {
            incrementMap(stats.recentKeywordCounts, keyword);
          }
        }

        categoryStats.set(key, stats);
      }
    }

    const categoryEntries = [...categoryStats.values()];
    const maxCategoryCount = Math.max(
      1,
      ...categoryEntries.map((entry) => entry.totalCount),
    );
    const maxRecentCount = Math.max(
      1,
      ...categoryEntries.map((entry) => entry.recentCount),
    );
    const averageCategoryCount =
      categoryEntries.length === 0
        ? 0
        : categoryEntries.reduce((total, entry) => total + entry.totalCount, 0) /
          categoryEntries.length;
    const overWrittenTopics = categoryEntries
      .filter((entry) => entry.totalCount > averageCategoryCount + 1)
      .map((entry) => entry.name);
    const underWrittenTopics = categoryEntries
      .filter((entry) => entry.recentCount === 0 || entry.totalCount <= averageCategoryCount)
      .map((entry) => entry.name);
    const seeds: TopicGapSeed[] = [];

    for (const entry of categoryEntries) {
      const keywords = [...entry.keywordCounts.entries()]
        .map(([keyword, totalCount]) => ({
          keyword,
          totalCount,
          recentCount: entry.recentKeywordCounts.get(keyword) ?? 0,
        }))
        .sort((left, right) => {
          if (right.totalCount !== left.totalCount) {
            return right.totalCount - left.totalCount;
          }

          if (left.recentCount !== right.recentCount) {
            return left.recentCount - right.recentCount;
          }

          return right.keyword.length - left.keyword.length;
        })
        .slice(0, 4);

      for (const keyword of keywords) {
        const semanticGap = clamp(
          1 - keyword.recentCount / Math.max(1, keyword.totalCount),
          0,
          1,
        );
        const recentPublishingFrequency = clamp(
          entry.recentCount / maxRecentCount,
          0,
          1,
        );
        const categoryDiversity = clamp(
          1 - entry.totalCount / maxCategoryCount,
          0,
          1,
        );
        const freshness = clamp(
          entry.staleCount / Math.max(1, entry.totalCount) +
            (keyword.recentCount === 0 ? 0.25 : 0),
          0,
          1,
        );
        const seoOpportunity = clamp(
          0.4 +
            (keyword.keyword.split(" ").length > 1 ? 0.2 : 0.05) +
            (keyword.recentCount === 0 ? 0.2 : 0) +
            (keyword.keyword.length >= 10 ? 0.1 : 0),
          0,
          1,
        );
        const businessValue = clamp(
          0.45 +
            (HIGH_VALUE_TERMS.has(keyword.keyword.split(" ")[0] ?? "") ? 0.2 : 0) +
            (entry.totalCount > 1 ? 0.1 : 0) +
            (entry.recentCount === 0 ? 0.15 : 0) +
            (entry.name !== "General" ? 0.1 : 0),
          0,
          1,
        );

        seeds.push({
          category: entry.name === "General" ? null : entry.name,
          keyword: titleCase(keyword.keyword),
          semanticGap,
          businessValue,
          seoOpportunity,
          categoryDiversity,
          freshness,
          recentPublishingFrequency,
        });
      }
    }

    const rankedSeeds = seeds.sort((left, right) => {
      const leftScore =
        left.semanticGap * 0.3 +
        left.businessValue * 0.2 +
        left.seoOpportunity * 0.2 +
        left.categoryDiversity * 0.15 +
        left.freshness * 0.15;
      const rightScore =
        right.semanticGap * 0.3 +
        right.businessValue * 0.2 +
        right.seoOpportunity * 0.2 +
        right.categoryDiversity * 0.15 +
        right.freshness * 0.15;

      return rightScore - leftScore;
    });
    const missingClusters = rankedSeeds
      .filter((seed) => !recentTopics.some((topic) => normalizeText(topic).includes(normalizeText(seed.keyword))))
      .map((seed) => seed.keyword)
      .slice(0, 5);

    return {
      existingTopics,
      recentTopics,
      overWrittenTopics,
      underWrittenTopics,
      missingClusters,
      staleContent: [...staleContent].slice(0, 5),
      highValueGaps: rankedSeeds.slice(0, 10),
    };
  },
});
