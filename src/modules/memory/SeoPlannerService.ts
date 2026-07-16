import type { ProjectProfileRecord } from "../../database/schema/index.js";
import type { SearchResultItem } from "../search/search.service.js";
import type { RecommendedCategory } from "./CategoryService.js";
import type { RecommendedInternalLink } from "./InternalLinkService.js";

export type SearchIntent =
  | "Informational"
  | "Commercial Investigation"
  | "Transactional"
  | "Comparison"
  | "Implementation"
  | "Strategic Planning";

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

  if (/(comparison|compare|vs|versus|alternative)/.test(normalized)) {
    return "Comparison";
  }

  if (/(implementation|rollout|deployment|integration|migration|checklist)/.test(normalized)) {
    return "Implementation";
  }

  if (/(service|partner|consulting|scope|quote|project)/.test(normalized)) {
    return "Transactional";
  }

  if (/(buyer|vendor|evaluate|selection|solution|platform)/.test(normalized)) {
    return "Commercial Investigation";
  }

  if (/(strategy|roadmap|governance|planning|roi|leadership|leader)/.test(normalized)) {
    return "Strategic Planning";
  }

  return "Informational";
};

const extractPrimaryKeyword = (topic: string): string =>
  titleCase(
    normalizeText(topic.replace(/[?!]/g, " "))
      .split(" ")
      .filter(Boolean)
      .join(" "),
  );

const deriveStem = (primaryKeyword: string): string =>
  normalizeText(primaryKeyword)
    .replace(/^how to (measure|build|implement|compare|evaluate|scope)\s+/, "")
    .replace(/^what [a-z\s]+ should know about\s+/, "")
    .replace(/^why\s+/, "")
    .replace(/^when\s+/, "")
    .replace(/\bfor \d{4}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const buildEditorTitle = (input: {
  primaryKeyword: string;
  searchIntent: SearchIntent;
}): string => {
  const { primaryKeyword, searchIntent } = input;

  const title =
    searchIntent === "Strategic Planning"
      ? `How Business Leaders Can Build ${primaryKeyword}`
      : searchIntent === "Implementation"
        ? `${primaryKeyword}: A Practical Rollout Plan`
        : searchIntent === "Comparison"
          ? `${primaryKeyword}: What Decision-Makers Should Compare First`
          : searchIntent === "Commercial Investigation"
            ? `${primaryKeyword}: What to Evaluate Before You Commit`
            : searchIntent === "Transactional"
              ? `${primaryKeyword}: When to Bring in an Implementation Partner`
              : `${primaryKeyword}: What Leaders Need to Know`;

  return trimToLength(title, 72);
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
    keywords: _keywords,
    profile,
    category,
    relatedArticles,
    internalLinks,
  }) => {
    const intent = inferSearchIntent(topic);
    const brandName = profile?.brandName?.trim();
    const keywordPool = buildKeywordPool({
      topic,
      keywords: _keywords,
      profile,
      category,
      relatedArticles,
      internalLinks,
    });
    const primaryKeyword = extractPrimaryKeyword(topic);
    const stem = deriveStem(primaryKeyword);
    const audience = profile?.targetAudience?.[0]?.trim();
    const industry = profile?.industry?.trim();
    const secondaryKeywordCandidates =
      intent === "Strategic Planning"
        ? [
            `${stem} strategy`,
            `${stem} roadmap`,
            `${stem} framework`,
            `how to measure ${stem} roi`,
            audience ? `${stem} for ${normalizeText(audience)}` : "",
          ]
        : intent === "Implementation"
          ? [
              `${stem} implementation guide`,
              `${stem} rollout checklist`,
              `how to implement ${stem}`,
              `${stem} implementation roadmap`,
            ]
          : intent === "Comparison"
            ? [
                `${stem} comparison`,
                `how to compare ${stem} options`,
                `${stem} vs traditional automation`,
                `${stem} evaluation criteria`,
              ]
            : intent === "Commercial Investigation"
              ? [
                  `${stem} buyer guide`,
                  `how to evaluate ${stem} solutions`,
                  `${stem} vendor checklist`,
                  `${stem} selection criteria`,
                ]
              : intent === "Transactional"
                ? [
                    `${stem} implementation partner`,
                    `${stem} consulting services`,
                    `how to scope ${stem} project`,
                    `${stem} service engagement`,
                  ]
                : [
                    `${stem} best practices`,
                    `${stem} explained`,
                    `${stem} examples`,
                    `${stem} common mistakes`,
                  ];
    const stemTokens = new Set(tokenize(stem));
    const secondaryKeywords = uniqueStrings([
      ...secondaryKeywordCandidates,
      ...keywordPool.map((phrase) => normalizeText(phrase)),
    ])
      .map((phrase) => titleCase(phrase))
      .filter((phrase) => normalizeText(phrase) !== normalizeText(primaryKeyword))
      .filter((phrase) => tokenize(phrase).length >= 3)
      .filter((phrase) => {
        const phraseTokens = tokenize(phrase);
        const overlap = phraseTokens.filter((token) => stemTokens.has(token)).length;
        return overlap >= Math.min(2, Math.max(1, stemTokens.size));
      })
      .filter((phrase) => !["ai", "enterprise ai", "business ai", "ai agents"].includes(normalizeText(phrase)))
      .slice(0, 8);
    const faqKeywords = uniqueStrings([
      intent === "Comparison"
        ? `How do you compare ${normalizeText(primaryKeyword)} options`
        : intent === "Implementation"
          ? `How do you implement ${normalizeText(primaryKeyword)} successfully`
          : `What should leaders know about ${normalizeText(primaryKeyword)}`,
      `How do you measure ROI for ${normalizeText(primaryKeyword)}`,
      `Which teams should own ${normalizeText(primaryKeyword)}`,
      ...secondaryKeywords.slice(0, 3).map((phrase) =>
        `When should you prioritize ${normalizeText(phrase)}`
      ),
    ])
      .map((phrase) => titleCase(phrase))
      .slice(0, 5);
    const title = buildEditorTitle({
      primaryKeyword,
      searchIntent: intent,
    });
    const metaTitle = trimToLength(
      brandName
        ? `${title} | ${brandName}`
        : title,
      60,
    );
    const metaDescription = padToRange(
      [
        intent === "Implementation"
          ? `Learn how to execute ${normalizeText(primaryKeyword)} with a practical rollout plan`
          : intent === "Comparison"
            ? `Compare the tradeoffs behind ${normalizeText(primaryKeyword)} and choose the right approach`
            : intent === "Strategic Planning"
              ? `Build a practical plan for ${normalizeText(primaryKeyword)} with clearer priorities and measurable outcomes`
              : `Understand ${normalizeText(primaryKeyword)} with practical guidance for business teams`,
        secondaryKeywords[0]
          ? `including ${normalizeText(secondaryKeywords[0])}`
          : "including strategy, execution, and decision guidance",
        brandName ? `from ${brandName}` : category?.name ? `for ${category.name}` : "",
        industry ? `in ${industry}` : "",
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
      slug: slugify(primaryKeyword),
      metaTitle,
      metaDescription,
      primaryKeyword,
      secondaryKeywords,
      faqKeywords,
      searchIntent: intent,
    };
  },
});
