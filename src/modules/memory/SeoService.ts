import { normalizeText } from "../context/ContextFilters.js";

export interface SeoRecommendations {
  recommendedTitleKeywords: string[];
  recommendedH2Keywords: string[];
  recommendedFaqKeywords: string[];
  recommendedSlug: string;
}

export interface SeoService {
  recommend(input: {
    topic: string;
    keywords: string[];
    language?: string | undefined;
  }): SeoRecommendations;
}

const slugify = (value: string): string =>
  normalizeText(value)
    .split(" ")
    .filter(Boolean)
    .join("-");

const uniqueTerms = (values: readonly string[]): string[] => [...new Set(values.filter(Boolean))];

export const createSeoService = (): SeoService => ({
  recommend: ({ topic, keywords }) => {
    const seedKeywords = uniqueTerms([
      ...normalizeText(topic).split(" ").filter((word) => word.length >= 3),
      ...keywords.map((keyword) => normalizeText(keyword)),
    ]);

    return {
      recommendedTitleKeywords: seedKeywords.slice(0, 6),
      recommendedH2Keywords: seedKeywords.slice(0, 8),
      recommendedFaqKeywords: seedKeywords.slice(0, 5),
      recommendedSlug: slugify(topic),
    };
  },
});
