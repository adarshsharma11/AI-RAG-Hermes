import type { TopicGapAnalysis, TopicGapSeed } from "./TopicGapAnalyzer.js";

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (value: string): string =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const INTENT_PATTERNS = [
  {
    name: "best",
    build: (base: string) => `Best ${base}`,
  },
  {
    name: "guide",
    build: (base: string) => `${base} Guide`,
  },
  {
    name: "ideas",
    build: (base: string) => `${base} Ideas`,
  },
  {
    name: "tips",
    build: (base: string) => `${base} Tips`,
  },
  {
    name: "trends",
    build: (base: string) => `${base} Trends`,
  },
  {
    name: "mistakes",
    build: (base: string) => `${base} Mistakes To Avoid`,
  },
] as const;

export interface TopicCandidate {
  topic: string;
  category: string | null;
  semanticUniqueness: number;
  semanticGap: number;
  businessValue: number;
  seoOpportunity: number;
  serviceRelevance: number;
  internalLinkOpportunity: number;
  categoryDiversity: number;
  freshness: number;
  recentPublishingFrequency: number;
  duplicateScore: number;
}

export interface TopicGenerator {
  generateCandidates(input: {
    analysis: TopicGapAnalysis;
    seedKeywords?: string[] | undefined;
    limit: number;
    offset?: number | undefined;
  }): TopicCandidate[];
}

const countIntentUsage = (
  existingTopics: readonly string[],
): Map<string, number> => {
  const usage = new Map<string, number>();

  for (const pattern of INTENT_PATTERNS) {
    usage.set(pattern.name, 0);
  }

  for (const topic of existingTopics) {
    const normalized = normalizeText(topic);

    for (const pattern of INTENT_PATTERNS) {
      if (normalized.includes(pattern.name)) {
        usage.set(pattern.name, (usage.get(pattern.name) ?? 0) + 1);
      }
    }
  }

  return usage;
};

const buildBasePhrase = (
  seed: TopicGapSeed,
  preferredKeyword: string | null,
): string => {
  const keyword = preferredKeyword ?? seed.keyword;

  if (!seed.category) {
    return titleCase(keyword);
  }

  const normalizedCategory = normalizeText(seed.category);
  const normalizedKeyword = normalizeText(keyword);

  if (normalizedKeyword.includes(normalizedCategory)) {
    return titleCase(keyword);
  }

  return titleCase(`${seed.category} ${keyword}`);
};

const tokenize = (value: string): string[] =>
  normalizeText(value).split(" ").filter((part) => part.length >= 3);

const computeSemanticUniqueness = (
  topic: string,
  existingTopics: readonly string[],
): number => {
  const topicTokens = new Set(tokenize(topic));

  if (topicTokens.size === 0 || existingTopics.length === 0) {
    return 1;
  }

  let maxOverlap = 0;

  for (const existingTopic of existingTopics) {
    const existingTokens = new Set(tokenize(existingTopic));

    if (existingTokens.size === 0) {
      continue;
    }

    const overlap = [...topicTokens].filter((token) => existingTokens.has(token)).length;
    maxOverlap = Math.max(maxOverlap, overlap / Math.max(topicTokens.size, existingTokens.size));
  }

  return Number(Math.max(0.2, 1 - maxOverlap).toFixed(4));
};

const computeServiceRelevance = (
  topic: string,
  serviceTerms: readonly string[],
): number => {
  if (serviceTerms.length === 0) {
    return 0.4;
  }

  const normalizedTopic = normalizeText(topic);
  const matched = serviceTerms.filter((term) => normalizedTopic.includes(term)).length;
  return Number(Math.min(1, 0.45 + matched * 0.18).toFixed(4));
};

const computeInternalLinkOpportunity = (
  seed: TopicGapSeed,
  analysis: TopicGapAnalysis,
): number => {
  const normalizedCategory = normalizeText(seed.category ?? "");
  const overWrittenMatch = analysis.overWrittenTopics.some((topic) =>
    normalizeText(topic) === normalizedCategory
  );
  const underWrittenMatch = analysis.underWrittenTopics.some((topic) =>
    normalizeText(topic) === normalizedCategory
  );

  const score =
    0.45 +
    (overWrittenMatch ? 0.25 : 0) +
    (underWrittenMatch ? 0.1 : 0) +
    Math.min(0.15, analysis.recentTopics.length * 0.01);

  return Number(Math.min(1, score).toFixed(4));
};

const createCandidate = (
  input: {
    topic: string;
    category: string | null;
    analysis: TopicGapAnalysis;
    seed: TopicGapSeed;
  },
): TopicCandidate => ({
  topic: input.topic,
  category: input.category,
  semanticUniqueness: computeSemanticUniqueness(
    input.topic,
    input.analysis.existingTopics,
  ),
  semanticGap: input.seed.semanticGap,
  businessValue: input.seed.businessValue,
  seoOpportunity: input.seed.seoOpportunity,
  serviceRelevance: computeServiceRelevance(
    input.topic,
    input.analysis.profileKeywords,
  ),
  internalLinkOpportunity: computeInternalLinkOpportunity(
    input.seed,
    input.analysis,
  ),
  categoryDiversity: input.seed.categoryDiversity,
  freshness: input.seed.freshness,
  recentPublishingFrequency: input.seed.recentPublishingFrequency,
  duplicateScore: 0,
});

export const createTopicGenerator = (): TopicGenerator => ({
  generateCandidates: ({ analysis, seedKeywords = [], limit, offset = 0 }) => {
    const intentUsage = countIntentUsage(analysis.existingTopics);
    const intents = [...INTENT_PATTERNS].sort(
      (left, right) =>
        (intentUsage.get(left.name) ?? 0) - (intentUsage.get(right.name) ?? 0),
    );
    const normalizedExistingTopics = new Set(
      analysis.existingTopics.map((topic) => normalizeText(topic)),
    );
    const normalizedSeedKeywords = [
      ...analysis.profileKeywords,
      ...seedKeywords.map((keyword) => normalizeText(keyword)),
    ]
      .filter(Boolean);
    const avoidTopics = new Set(analysis.avoidTopics);
    const candidates: TopicCandidate[] = [];
    const seen = new Set<string>();

    for (const preferredTopic of analysis.preferredTopics) {
      const topic = titleCase(preferredTopic);
      const normalizedTopic = normalizeText(topic);

      if (
        normalizedTopic.length === 0 ||
        normalizedExistingTopics.has(normalizedTopic) ||
        seen.has(normalizedTopic) ||
        avoidTopics.has(normalizedTopic)
      ) {
        continue;
      }

      seen.add(normalizedTopic);
      candidates.push(
        createCandidate({
          topic,
          category: null,
          analysis,
          seed: {
            category: null,
            keyword: preferredTopic,
            semanticGap: 0.92,
            businessValue: 0.85,
            seoOpportunity: 0.8,
            categoryDiversity: 0.75,
            freshness: 0.9,
            recentPublishingFrequency: 0,
          },
        }),
      );
    }

    for (const seed of analysis.highValueGaps) {
      const seedVariants = normalizedSeedKeywords.length > 0
        ? normalizedSeedKeywords
        : [normalizeText(seed.keyword)];

      for (const keyword of seedVariants) {
        const base = buildBasePhrase(seed, keyword);

        for (const intent of intents) {
          const topic = titleCase(intent.build(base));
          const normalizedTopic = normalizeText(topic);

          if (
            normalizedTopic.length === 0 ||
            normalizedExistingTopics.has(normalizedTopic) ||
            seen.has(normalizedTopic) ||
            avoidTopics.has(normalizedTopic)
          ) {
            continue;
          }

          seen.add(normalizedTopic);
          candidates.push(
            createCandidate({
              topic,
              category: seed.category,
              analysis,
              seed,
            }),
          );
        }
      }
    }

    for (const keyword of normalizedSeedKeywords.slice(0, 10)) {
      const serviceTopics = [
        `${titleCase(keyword)} For Homeowners`,
        `How To Plan ${titleCase(keyword)}`,
        `${titleCase(keyword)} Cost And Value Guide`,
        `Best ${titleCase(keyword)} Options`,
      ];

      for (const topic of serviceTopics) {
        const normalizedTopic = normalizeText(topic);

        if (
          normalizedExistingTopics.has(normalizedTopic) ||
          seen.has(normalizedTopic) ||
          avoidTopics.has(normalizedTopic)
        ) {
          continue;
        }

        seen.add(normalizedTopic);
        candidates.push(
          createCandidate({
            topic,
            category: null,
            analysis,
            seed: {
              category: null,
              keyword,
              semanticGap: 0.82,
              businessValue: 0.84,
              seoOpportunity: 0.86,
              categoryDiversity: 0.68,
              freshness: 0.8,
              recentPublishingFrequency: 0.1,
            },
          }),
        );
      }
    }

    for (const cluster of analysis.missingClusters) {
      const topic = titleCase(`${cluster} Guide`);
      const normalizedTopic = normalizeText(topic);

      if (
        normalizedExistingTopics.has(normalizedTopic) ||
        seen.has(normalizedTopic) ||
        avoidTopics.has(normalizedTopic)
      ) {
        continue;
      }

      seen.add(normalizedTopic);
      candidates.push(
        createCandidate({
          topic,
          category: null,
          analysis,
          seed: {
            category: null,
            keyword: cluster,
            semanticGap: 0.8,
            businessValue: 0.65,
            seoOpportunity: 0.7,
            categoryDiversity: 0.75,
            freshness: 0.8,
            recentPublishingFrequency: 0,
          },
        }),
      );
    }

    return candidates.slice(offset, offset + limit);
  },
});
