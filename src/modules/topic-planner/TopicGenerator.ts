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
  semanticGap: number;
  businessValue: number;
  seoOpportunity: number;
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
      candidates.push({
        topic,
        category: null,
        semanticGap: 0.92,
        businessValue: 0.85,
        seoOpportunity: 0.8,
        categoryDiversity: 0.75,
        freshness: 0.9,
        recentPublishingFrequency: 0,
        duplicateScore: 0,
      });
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
          candidates.push({
            topic,
            category: seed.category,
            semanticGap: seed.semanticGap,
            businessValue: seed.businessValue,
            seoOpportunity: seed.seoOpportunity,
            categoryDiversity: seed.categoryDiversity,
            freshness: seed.freshness,
            recentPublishingFrequency: seed.recentPublishingFrequency,
            duplicateScore: 0,
          });
        }
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
      candidates.push({
        topic,
        category: null,
        semanticGap: 0.8,
        businessValue: 0.65,
        seoOpportunity: 0.7,
        categoryDiversity: 0.75,
        freshness: 0.8,
        recentPublishingFrequency: 0,
        duplicateScore: 0,
      });
    }

    return candidates.slice(offset, offset + limit);
  },
});
