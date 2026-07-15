import type { ContextResponse } from "../context/ContextService.js";
import type { SearchResultItem } from "../search/search.service.js";
import type { RecommendedCategory } from "./CategoryService.js";
import type {
  DuplicateDetectionResult,
  DuplicateMatch,
} from "./DuplicateDetector.js";
import type { RecommendedInternalLink } from "./InternalLinkService.js";
import type { SeoRecommendations } from "./SeoService.js";

export interface RecommendedKeywords {
  primary: string[];
  title: string[];
  h2: string[];
  faq: string[];
  slug: string;
}

export interface MemoryWarning {
  code: string;
  message: string;
}

export interface MemoryRelatedArticle {
  id: string;
  title: string | null;
  url: string | null;
  score: number;
  excerpt: string;
}

export interface MemoryResponse {
  topic: string;
  duplicate: boolean;
  duplicateScore: number;
  duplicateMatch: DuplicateMatch | null;
  recommendedCategory: RecommendedCategory | null;
  recommendedKeywords: RecommendedKeywords;
  recommendedInternalLinks: RecommendedInternalLink[];
  internalLinks: RecommendedInternalLink[];
  context: ContextResponse;
  relatedArticles: MemoryRelatedArticle[];
  warnings: MemoryWarning[];
  generatedAt: string;
}

export interface GenerationPlanner {
  buildPlan(input: {
    topic: string;
    duplicateDetection: DuplicateDetectionResult;
    category: RecommendedCategory | null;
    seo: SeoRecommendations;
    context: ContextResponse;
    internalLinks: RecommendedInternalLink[];
    relatedArticles: SearchResultItem[];
    provider: string;
    task: string;
    language: string;
    tone: string;
  }): MemoryResponse;
}

const toRelatedArticle = (article: SearchResultItem): MemoryRelatedArticle => ({
  id: article.id,
  title: article.title,
  url: article.url,
  score: article.score,
  excerpt: article.excerpt,
});

export const createGenerationPlanner = (): GenerationPlanner => ({
  buildPlan: ({
    topic,
    duplicateDetection,
    category,
    seo,
    context,
    internalLinks,
    relatedArticles,
    provider,
    task,
    language,
    tone,
  }) => {
    const warnings: MemoryWarning[] = [];

    if (duplicateDetection.duplicate) {
      warnings.push({
        code: "DUPLICATE_CONTENT_RISK",
        message: "A highly similar article already exists for this topic.",
      });
    }

    if (context.documents.length === 0) {
      warnings.push({
        code: "LOW_CONTEXT_SIGNAL",
        message: "No strong context was available for this request.",
      });
    }

    if (internalLinks.length === 0) {
      warnings.push({
        code: "NO_INTERNAL_LINKS",
        message: "No relevant internal links were found for this topic.",
      });
    }

    warnings.push({
      code: "PLANNER_PROFILE",
      message: `Planned for task=${task}, provider=${provider}, language=${language}, tone=${tone}.`,
    });

    return {
      topic,
      duplicate: duplicateDetection.duplicate,
      duplicateScore: duplicateDetection.duplicateScore,
      duplicateMatch: duplicateDetection.matchingArticle,
      recommendedCategory: category,
      recommendedKeywords: {
        primary: seo.recommendedTitleKeywords,
        title: seo.recommendedTitleKeywords,
        h2: seo.recommendedH2Keywords,
        faq: seo.recommendedFaqKeywords,
        slug: seo.recommendedSlug,
      },
      recommendedInternalLinks: internalLinks,
      internalLinks,
      context,
      relatedArticles: relatedArticles.map(toRelatedArticle),
      warnings,
      generatedAt: new Date().toISOString(),
    };
  },
});
