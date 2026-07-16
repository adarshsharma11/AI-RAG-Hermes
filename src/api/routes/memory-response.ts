import type {
  MemoryResponse,
  MemoryWarning,
} from "../../modules/memory/GenerationPlanner.js";

type NullableString = string | null;

export interface ApiContextDocument {
  title: NullableString;
  url: NullableString;
  excerpt: string;
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

const clampLength = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  const trimmed = value.slice(0, maxLength);
  const lastSentence = Math.max(
    trimmed.lastIndexOf(". "),
    trimmed.lastIndexOf("? "),
    trimmed.lastIndexOf("! "),
  );
  const lastWord = trimmed.lastIndexOf(" ");
  const boundary = lastSentence >= 250 ? lastSentence + 1 : lastWord >= 250 ? lastWord : maxLength;

  return trimmed.slice(0, boundary).trim();
};

const buildExcerpt = (input: {
  excerpt: string;
  context?: string | undefined;
}): string => {
  const primary = cleanText(input.excerpt);

  if (primary.length >= 400) {
    return clampLength(primary, 700);
  }

  const fallback = cleanText([input.excerpt, input.context ?? ""].filter(Boolean).join(" "));
  return clampLength(fallback || primary, 700);
};

const normalizeHeadingKey = (value: string): string => cleanText(value).toLowerCase();

const toOutlineTitle = (input: {
  heading: string;
  index: number;
}): string => {
  const normalized = normalizeHeadingKey(input.heading);

  if (input.index === 0 || /^(what is|what does|introduction|overview)\b/.test(normalized)) {
    return "Introduction";
  }
  if (/\bwhy\b|\bmatters\b|\bimportance\b|\bbenefit\b/.test(normalized)) {
    return "Why It Matters";
  }
  if (/\bconsideration\b|\bcriteria\b|\bevaluate\b|\bframework\b|\bcompare\b|\btradeoff\b/.test(normalized)) {
    return "Key Considerations";
  }
  if (/\bimplement\b|\bimplementation\b|\brollout\b|\broadmap\b|\bstep\b|\bscope\b|\bplan\b/.test(normalized)) {
    return "Implementation Steps";
  }
  if (/\bmistake\b|\brisk\b|\bpitfall\b|\bblocker\b/.test(normalized)) {
    return "Common Mistakes";
  }
  if (/\bmeasure\b|\bmetric\b|\broi\b|\bsuccess\b|\bkpi\b/.test(normalized)) {
    return "Measuring Success";
  }
  if (/\bconclusion\b|\bnext step\b|\bfaq\b|\bquestion\b/.test(normalized)) {
    return "Conclusion";
  }

  return (
    [
      "Introduction",
      "Why It Matters",
      "Key Considerations",
      "Implementation Steps",
      "Common Mistakes",
      "Measuring Success",
      "Conclusion",
    ][input.index] ?? "Conclusion"
  );
};

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
  outline: response.outline.map((section, index) => ({
    title: toOutlineTitle({
      heading: section.heading,
      index,
    }),
    points: [],
  })),
  context: {
    documents: response.context.documents.slice(0, 3).map((document) => ({
      title: document.title,
      url: document.url,
      excerpt: buildExcerpt({
        excerpt: document.excerpt,
        context: document.context,
      }),
    })),
    totalCharacters: Math.min(
      2500,
      response.context.documents
        .slice(0, 3)
        .map((document) =>
          buildExcerpt({
            excerpt: document.excerpt,
            context: document.context,
          }).length,
        )
        .reduce((total, length) => total + length, 0),
    ),
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
