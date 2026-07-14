import type { SearchResultItem } from "../search/search.service.js";
import type { RecommendedCategory } from "./CategoryService.js";

export interface RecommendedInternalLink {
  id: string;
  title: string | null;
  url: string | null;
  score: number;
  excerpt: string;
  category: string | null;
}

export interface InternalLinkService {
  recommendLinks(input: {
    topic: string;
    relatedArticles: SearchResultItem[];
    category: RecommendedCategory | null;
    excludeIds?: string[] | undefined;
  }): RecommendedInternalLink[];
}

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getPrimaryCategory = (metadata: Record<string, unknown>): string | null => {
  const categories = metadata.categories;

  if (!Array.isArray(categories) || categories.length === 0) {
    return null;
  }

  const first = categories[0];

  if (!first || typeof first !== "object") {
    return null;
  }

  const record = first as Record<string, unknown>;
  return typeof record.name === "string" ? record.name : null;
};

const countTopicMatches = (topic: string, value: string): number => {
  const topicWords = normalizeText(topic).split(" ").filter((word) => word.length >= 3);
  const normalizedValue = normalizeText(value);

  return topicWords.filter((word) => normalizedValue.includes(word)).length;
};

export const createInternalLinkService = (): InternalLinkService => ({
  recommendLinks: ({ topic, relatedArticles, category, excludeIds = [] }) =>
    relatedArticles
      .filter((article) => !excludeIds.includes(article.id))
      .map((article) => {
        const primaryCategory = getPrimaryCategory(article.metadata);
        const sameCategory =
          category?.name !== undefined &&
          primaryCategory !== null &&
          normalizeText(primaryCategory) === normalizeText(category.name);
        const topicMatchCount = countTopicMatches(
          topic,
          `${article.title ?? ""} ${article.excerpt}`.trim(),
        );
        const weightedScore =
          article.score +
          (sameCategory ? 0.2 : 0) +
          Math.min(0.15, topicMatchCount * 0.03);

        return {
          id: article.id,
          title: article.title,
          url: article.url,
          score: Number(weightedScore.toFixed(4)),
          excerpt: article.excerpt,
          category: primaryCategory,
        } satisfies RecommendedInternalLink;
      })
      .filter((article) => article.url !== null)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5),
});
