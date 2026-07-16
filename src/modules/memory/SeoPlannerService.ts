import type { ProjectProfileRecord } from "../../database/schema/index.js";
import type { SearchResultItem } from "../search/search.service.js";
import type { RecommendedCategory } from "./CategoryService.js";
import type { RecommendedInternalLink } from "./InternalLinkService.js";

export type SearchIntent =
  | "Informational"
  | "Commercial"
  | "Transactional"
  | "Navigational";

export interface SeoBrief {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  faqKeywords: string[];
  searchIntent: SearchIntent;
}

export interface SeoPlannerService {
  plan(input: {
    topic: string;
    keywords: string[];
    language: string;
    profile?: ProjectProfileRecord | null | undefined;
    category: RecommendedCategory | null;
    relatedArticles: SearchResultItem[];
    internalLinks: RecommendedInternalLink[];
  }): SeoBrief;
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

const slugify = (value: string): string =>
  normalizeText(value)
    .split(" ")
    .filter(Boolean)
    .join("-");

const uniqueStrings = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))];

const tokenize = (value: string): string[] =>
  normalizeText(value).split(" ").filter((part) => part.length >= 3);

const trimToLength = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength - 1);
  const lastSpace = truncated.lastIndexOf(" ");

  return `${(lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim()}...`;
};

const padToRange = (value: string, minLength: number, maxLength: number): string => {
  let result = value;

  while (result.length < minLength) {
    result = `${result} Trusted advice helps readers compare options and plan next steps.`
      .replace(/\s+/g, " ")
      .trim();
  }

  return trimToLength(result, maxLength);
};

const inferSearchIntent = (topic: string): SearchIntent => {
  const normalized = normalizeText(topic);

  if (/(buy|pricing|cost|quote|service|near me|book)/.test(normalized)) {
    return "Transactional";
  }

  if (/(best|vs|review|compare|top)/.test(normalized)) {
    return "Commercial";
  }

  if (/(login|portal|contact|website|brand)/.test(normalized)) {
    return "Navigational";
  }

  return "Informational";
};

const inferBusinessIntent = (topic: string): "Awareness" | "Evaluation" | "Conversion" => {
  const normalized = normalizeText(topic);

  if (/(implementation|roadmap|migration|deployment|rollout)/.test(normalized)) {
    return "Conversion";
  }

  if (/(roi|comparison|checklist|framework|best practices)/.test(normalized)) {
    return "Evaluation";
  }

  return "Awareness";
};

const extractPrimaryKeyword = (
  topic: string,
  keywordPool: readonly string[],
): string => {
  const normalizedTopic = normalizeText(topic);
  const candidate = keywordPool
    .map((keyword) => normalizeText(keyword))
    .filter((keyword) => keyword.length >= 4)
    .find((keyword) => normalizedTopic.includes(keyword));

  if (candidate) {
    return titleCase(candidate);
  }

  return titleCase(
    tokenize(topic)
      .slice(0, 4)
      .join(" "),
  );
};

const buildSeoTitle = (input: {
  topic: string;
  primaryKeyword: string;
  industry: string | null;
  businessIntent: "Awareness" | "Evaluation" | "Conversion";
}): string => {
  const prefix =
    input.businessIntent === "Conversion"
      ? "Implementation Guide:"
      : input.businessIntent === "Evaluation"
        ? "Executive Guide:"
        : "Practical Guide:";
  const suffix = input.industry ? `for ${input.industry}` : "";

  return trimToLength(
    uniqueStrings([prefix, input.primaryKeyword, suffix]).join(" "),
    72,
  );
};

const buildKeywordPool = (input: {
  topic: string;
  keywords: readonly string[];
  profile?: ProjectProfileRecord | null | undefined;
  category: RecommendedCategory | null;
  relatedArticles: readonly SearchResultItem[];
  internalLinks: readonly RecommendedInternalLink[];
}): string[] => {
  const pool = uniqueStrings([
    input.topic,
    ...input.keywords,
    ...(input.profile?.seedKeywords ?? []),
    ...(input.profile?.seoFocus ?? []),
    ...(input.profile?.services ?? []),
    ...(input.profile?.preferredTopics ?? []),
    ...(input.category?.name ? [input.category.name] : []),
    ...input.relatedArticles
      .map((article) => article.title ?? "")
      .filter(Boolean),
    ...input.internalLinks
      .map((article) => article.title ?? "")
      .filter(Boolean),
  ]);

  return pool.filter((phrase) => normalizeText(phrase).length >= 4);
};

export const createSeoPlannerService = (): SeoPlannerService => ({
  plan: ({
    topic,
    keywords,
    profile,
    category,
    relatedArticles,
    internalLinks,
  }) => {
    const intent = inferSearchIntent(topic);
    const businessIntent = inferBusinessIntent(topic);
    const brandName = profile?.brandName?.trim();
    const industry = profile?.industry?.trim();
    const keywordPool = buildKeywordPool({
      topic,
      keywords,
      profile,
      category,
      relatedArticles,
      internalLinks,
    });
    const primaryKeyword = extractPrimaryKeyword(topic, keywordPool);
    const secondaryKeywords = keywordPool
      .map((phrase) => titleCase(phrase))
      .filter((phrase) => normalizeText(phrase) !== normalizeText(primaryKeyword))
      .filter((phrase) => !normalizeText(topic).includes(normalizeText(phrase)))
      .slice(0, 10);
    const faqKeywords = uniqueStrings([
      intent === "Commercial"
        ? `How to compare ${normalizeText(primaryKeyword)} options`
        : `How to implement ${normalizeText(primaryKeyword)}`,
      `What is the ROI of ${normalizeText(primaryKeyword)}`,
      `Which teams benefit from ${normalizeText(primaryKeyword)}`,
      ...secondaryKeywords.slice(0, 3).map((phrase) =>
        `When should you prioritize ${normalizeText(phrase)}`
      ),
    ])
      .map((phrase) => titleCase(phrase))
      .slice(0, 5);
    const title = buildSeoTitle({
      topic,
      primaryKeyword,
      industry: industry ?? null,
      businessIntent,
    });
    const metaTitle = trimToLength(
      uniqueStrings([
        primaryKeyword,
        businessIntent === "Conversion" ? "Implementation" : "Guide",
        brandName ?? category?.name ?? "",
      ]).join(" | "),
      60,
    );
    const metaDescription = padToRange(
      [
        businessIntent === "Conversion"
          ? `Plan ${normalizeText(primaryKeyword)} with a practical rollout approach`
          : `Learn how ${normalizeText(primaryKeyword)} supports measurable business outcomes`,
        secondaryKeywords[0]
          ? `including ${normalizeText(secondaryKeywords[0])}`
          : "including strategy, process, and execution guidance",
        brandName ? `from ${brandName}` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (char) => char.toUpperCase()),
      140,
      160,
    );

    return {
      title,
      slug: slugify(uniqueStrings([primaryKeyword, industry ?? ""]).join(" ")),
      metaTitle,
      metaDescription,
      primaryKeyword,
      secondaryKeywords,
      faqKeywords,
      searchIntent: intent,
    };
  },
});
