import type { SearchResultItem } from "../search/search.service.js";

interface CategoryCandidate {
  id: string | null;
  name: string;
  slug: string | null;
  score: number;
}

export interface RecommendedCategory {
  id: string | null;
  name: string;
  slug: string | null;
  confidence: number;
}

export interface CategoryService {
  recommendCategory(input: {
    topic: string;
    relatedArticles: SearchResultItem[];
  }): RecommendedCategory | null;
}

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const topicMatchesCategory = (topic: string, category: CategoryCandidate): boolean => {
  const normalizedTopic = normalizeText(topic);
  const normalizedCategory = normalizeText(
    `${category.name} ${category.slug ?? ""}`.trim(),
  );

  return normalizedTopic.includes(normalizedCategory) || normalizedCategory.includes(normalizedTopic);
};

const extractCategories = (metadata: Record<string, unknown>): CategoryCandidate[] => {
  const categories = metadata.categories;

  if (!Array.isArray(categories)) {
    return [];
  }

  return categories
    .map((category) => {
      if (!category || typeof category !== "object") {
        return null;
      }

      const record = category as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";

      if (!name) {
        return null;
      }

      return {
        id: typeof record.id === "string" ? record.id : null,
        name,
        slug: typeof record.slug === "string" ? record.slug : null,
        score: 0,
      } satisfies CategoryCandidate;
    })
    .filter((category): category is CategoryCandidate => category !== null);
};

export const createCategoryService = (): CategoryService => ({
  recommendCategory: ({ topic, relatedArticles }) => {
    const candidates = new Map<string, CategoryCandidate>();

    for (const article of relatedArticles) {
      const categories = extractCategories(article.metadata);

      for (const category of categories) {
        const key = `${category.id ?? ""}:${category.slug ?? ""}:${category.name}`;
        const existing = candidates.get(key);
        const boost = topicMatchesCategory(topic, category) ? 0.15 : 0;
        const score = article.score + boost;

        if (!existing) {
          candidates.set(key, {
            ...category,
            score,
          });
          continue;
        }

        existing.score += score;
      }
    }

    const ranked = [...candidates.values()].sort((left, right) => right.score - left.score);
    const winner = ranked[0];

    if (!winner) {
      return null;
    }

    const totalScore = ranked.reduce((total, candidate) => total + candidate.score, 0);

    return {
      id: winner.id,
      name: winner.name,
      slug: winner.slug,
      confidence:
        totalScore === 0 ? 0 : Number((winner.score / totalScore).toFixed(4)),
    };
  },
});
