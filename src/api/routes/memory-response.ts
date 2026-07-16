import type {
  MemoryResponse,
  MemoryWarning,
} from "../../modules/memory/GenerationPlanner.js";

type NullableString = string | null;

export interface ApiContextDocument {
  title: NullableString;
  url: NullableString;
  excerpt: string;
  context: string;
}

export interface ApiMemoryResponse {
  topic: string;
  duplicate: boolean;
  generationBrief: MemoryResponse["generationBrief"];
  seo: {
    title: string;
    slug: string;
    metaTitle: string;
    metaDescription: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    faqKeywords: string[];
  };
  recommendedCategory: MemoryResponse["recommendedCategory"];
  recommendedInternalLinks: Array<{
    title: NullableString;
    url: NullableString;
    anchorText: string;
  }>;
  outline: Array<{
    title: string;
    points: string[];
  }>;
  context: {
    documents: ApiContextDocument[];
    totalCharacters: number;
  };
  relatedArticles: Array<{
    title: NullableString;
    url: NullableString;
    category: NullableString;
    publishedAt: string | null;
  }>;
  warnings: MemoryWarning[];
}

const cleanText = (value: string): string =>
  value
    .replace(/^\s*[-*]\s+/g, "")
    .replace(/^\s*\d+[\).\s-]+/g, "")
    .replace(/^#{1,6}\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();

const toPhrase = (value: unknown): string => {
  if (typeof value === "string") {
    return cleanText(value);
  }

  if (Array.isArray(value)) {
    return cleanText(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .join(" "),
    );
  }

  return "";
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map(cleanText)
    .filter(Boolean);
};

const isActualWarning = (warning: MemoryWarning): boolean =>
  warning.code !== "PLANNER_PROFILE";

export const toApiMemoryResponse = (response: MemoryResponse): ApiMemoryResponse => ({
  topic: response.topic,
  duplicate: response.duplicate,
  generationBrief: response.generationBrief,
  seo: {
    title: cleanText(response.seo.title),
    slug: cleanText(response.seo.slug),
    metaTitle: cleanText(response.seo.metaTitle),
    metaDescription: cleanText(response.seo.metaDescription),
    primaryKeyword: toPhrase(response.seo.primaryKeyword),
    secondaryKeywords: toStringArray(response.seo.secondaryKeywords),
    faqKeywords: toStringArray(response.seo.faqKeywords),
  },
  recommendedCategory: response.recommendedCategory,
  recommendedInternalLinks: response.recommendedInternalLinks
    .filter((link) => link.url !== null)
    .slice(0, 3)
    .map((link) => ({
      title: link.title,
      url: link.url,
      anchorText: cleanText(link.title ?? link.category ?? "Related resource"),
    })),
  outline: response.outline.map((section) => ({
    title: cleanText(section.heading),
    points: section.subheadings.map(cleanText).filter(Boolean),
  })),
  context: {
    documents: response.context.documents.map((document) => ({
      title: document.title,
      url: document.url,
      excerpt: cleanText(document.excerpt),
      context: cleanText(document.context),
    })),
    totalCharacters: response.context.totalCharacters,
  },
  relatedArticles: response.relatedArticles.slice(0, 5).map((article) => {
    const record = article as unknown as Record<string, unknown>;
    const category =
      typeof record.category === "string"
        ? record.category
        : null;
    const publishedAt =
      typeof record.publishedAt === "string"
        ? record.publishedAt
        : null;

    return {
      title: article.title,
      url: article.url,
      category,
      publishedAt,
    };
  }),
  warnings: response.warnings.filter(isActualWarning),
});
