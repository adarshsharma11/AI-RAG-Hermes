import type { ContextResponse } from "../context/ContextService.js";
import type { SearchResultItem } from "../search/search.service.js";
import type { ProjectProfileRecord } from "../../database/schema/index.js";
import type { RecommendedCategory } from "./CategoryService.js";
import type {
  DuplicateDetectionResult,
  DuplicateMatch,
} from "./DuplicateDetector.js";
import type { RecommendedInternalLink } from "./InternalLinkService.js";
import type { RecommendedOutlineSection } from "./OutlinePlannerService.js";
import type { SeoBrief } from "./SeoPlannerService.js";
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

export interface GenerationBrief {
  objective: string;
  audience: string;
  tone: string;
  language: string;
  wordCount: string;
}

export interface MemoryResponse {
  topic: string;
  duplicate: boolean;
  duplicateScore: number;
  duplicateMatch: DuplicateMatch | null;
  generationBrief: GenerationBrief;
  recommendedCategory: RecommendedCategory | null;
  recommendedKeywords: RecommendedKeywords;
  recommendedInternalLinks: RecommendedInternalLink[];
  internalLinks: RecommendedInternalLink[];
  seo: SeoBrief;
  outline: RecommendedOutlineSection[];
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
    seoBrief: SeoBrief;
    outline: RecommendedOutlineSection[];
    context: ContextResponse;
    internalLinks: RecommendedInternalLink[];
    relatedArticles: SearchResultItem[];
    provider: string;
    task: string;
    language: string;
    tone: string;
    profile?: ProjectProfileRecord | null | undefined;
  }): MemoryResponse;
}

const toRelatedArticle = (article: SearchResultItem): MemoryRelatedArticle => ({
  id: article.id,
  title: article.title,
  url: article.url,
  score: article.score,
  excerpt: article.excerpt,
});

const titleCase = (value: string): string =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatLanguage = (language: string): string => {
  const normalized = language.trim().toLowerCase();

  if (normalized === "en" || normalized === "en-us" || normalized === "en-gb") {
    return "English";
  }

  return titleCase(normalized.replace(/[-_]/g, " "));
};

const formatAudience = (
  profile?: ProjectProfileRecord | null | undefined,
): string =>
  profile?.targetAudience?.length
    ? profile.targetAudience.join(", ")
    : "Business Owners, Founders, Executives";

const buildObjective = (input: {
  task: string;
  audience: string;
}): string => {
  const normalizedTask = input.task.trim().toLowerCase();
  const normalizedAudience = input.audience.toLowerCase();

  if (normalizedTask.includes("blog")) {
    return normalizedAudience.includes("leader") ||
        normalizedAudience.includes("owner") ||
        normalizedAudience.includes("founder") ||
        normalizedAudience.includes("executive")
      ? "Educate business leaders"
      : "Educate target readers";
  }

  if (normalizedTask.includes("landing") || normalizedTask.includes("conversion")) {
    return "Convert high-intent readers";
  }

  return "Educate target readers";
};

export const createGenerationPlanner = (): GenerationPlanner => ({
  buildPlan: ({
    topic,
    duplicateDetection,
    category,
    seo,
    seoBrief,
    outline,
    context,
    internalLinks,
    relatedArticles,
    provider,
    task,
    language,
    tone,
    profile,
  }) => {
    const warnings: MemoryWarning[] = [];
    const audience = formatAudience(profile);

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
      generationBrief: {
        objective: buildObjective({
          task,
          audience,
        }),
        audience,
        tone: titleCase(tone),
        language: formatLanguage(language),
        wordCount: "1000-1200",
      },
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
      seo: seoBrief,
      outline,
      context,
      relatedArticles: relatedArticles.map(toRelatedArticle),
      warnings,
      generatedAt: new Date().toISOString(),
    };
  },
});
