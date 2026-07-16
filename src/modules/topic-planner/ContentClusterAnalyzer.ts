import type {
  ContentItemRecord,
  ProjectProfileRecord,
  TopicHistoryRecord,
} from "../../database/schema/index.js";

const STRATEGIC_CLUSTER_SEEDS = [
  { label: "AI Agents", terms: ["ai agent", "agent", "autonomous"] },
  { label: "Governance", terms: ["governance", "policy", "guardrail"] },
  { label: "RAG", terms: ["rag", "retrieval", "knowledge base"] },
  { label: "Security", terms: ["security", "risk", "compliance"] },
  { label: "ROI", terms: ["roi", "cost", "business case"] },
  { label: "Implementation", terms: ["implementation", "deployment", "rollout"] },
  { label: "Strategy", terms: ["strategy", "roadmap", "planning"] },
  { label: "Operations", terms: ["operations", "observability", "monitoring"] },
] as const;

type ClusterSeed = {
  label: string;
  terms: readonly string[];
};

export interface ContentCluster {
  key: string;
  label: string;
  anchor: string;
  keywords: string[];
  articleTitles: string[];
  totalCount: number;
  recentCount: number;
  historyCount: number;
  serviceMatches: number;
  preferredMatches: number;
  lastPublishedAt: Date | null;
}

export interface ContentClusterAnalyzer {
  analyze(input: {
    contentItems: ContentItemRecord[];
    topicHistory: TopicHistoryRecord[];
    profile?: ProjectProfileRecord | null | undefined;
    seedKeywords?: string[] | undefined;
  }): ContentCluster[];
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

const tokenize = (value: string): string[] =>
  normalizeText(value)
    .split(" ")
    .filter((part) => part.length >= 3);

const extractTaxonomyNames = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      return typeof record.name === "string" ? record.name.trim() : null;
    })
    .filter((entry): entry is string => Boolean(entry));
};

const extractPublishedAt = (contentItem: ContentItemRecord): Date => {
  const metadata = contentItem.metadata;
  const publishedAt = metadata.publishedAt ?? metadata.published_at;
  const modifiedAt = metadata.modifiedAt ?? metadata.modified_at;

  for (const value of [publishedAt, modifiedAt]) {
    if (typeof value !== "string") {
      continue;
    }

    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return contentItem.createdAt;
};

const buildDynamicSeeds = (input: {
  contentItems: ContentItemRecord[];
  topicHistory: TopicHistoryRecord[];
  profile?: ProjectProfileRecord | null | undefined;
  seedKeywords: readonly string[];
}): Array<{ label: string; terms: string[] }> => {
  const phrases = new Map<string, number>();
  const sources = [
    ...input.contentItems.map((item) => item.title ?? ""),
    ...input.topicHistory.map((item) => item.topic),
    ...(input.profile?.services ?? []),
    ...(input.profile?.preferredTopics ?? []),
    ...(input.profile?.seedKeywords ?? []),
    ...(input.profile?.seoFocus ?? []),
    ...(input.profile?.targetAudience ?? []),
    ...(input.profile?.industry ? [input.profile.industry] : []),
    ...input.seedKeywords,
  ];

  for (const source of sources) {
    const tokens = tokenize(source);

    for (let index = 0; index < tokens.length; index += 1) {
      const unigram = tokens[index];
      const bigram = tokens[index + 1]
        ? `${tokens[index]} ${tokens[index + 1]}`
        : null;

      for (const phrase of [unigram, bigram]) {
        if (!phrase || phrase.length < 4) {
          continue;
        }

        phrases.set(phrase, (phrases.get(phrase) ?? 0) + 1);
      }
    }
  }

  return [...phrases.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([phrase]) => ({
      label: titleCase(phrase),
      terms: [phrase],
    }));
};

const scoreSeed = (
  source: string,
  seed: ClusterSeed,
): number => {
  const normalizedSource = normalizeText(source);
  return seed.terms.reduce(
    (total, term) => total + (normalizedSource.includes(normalizeText(term)) ? 1 : 0),
    0,
  );
};

const emptyCluster = (
  seed: ClusterSeed,
): ContentCluster => ({
  key: normalizeText(seed.label).replace(/\s+/g, "-"),
  label: titleCase(seed.label),
  anchor: titleCase(seed.terms[0] ?? seed.label),
  keywords: [...new Set(seed.terms.map((term) => titleCase(normalizeText(term))))],
  articleTitles: [],
  totalCount: 0,
  recentCount: 0,
  historyCount: 0,
  serviceMatches: 0,
  preferredMatches: 0,
  lastPublishedAt: null,
});

export const createContentClusterAnalyzer = (): ContentClusterAnalyzer => ({
  analyze: ({ contentItems, topicHistory, profile, seedKeywords = [] }) => {
    const recentThreshold = Date.now() - 1000 * 60 * 60 * 24 * 120;
    const serviceTerms = (profile?.services ?? []).map((value) => normalizeText(value));
    const preferredTerms = (profile?.preferredTopics ?? []).map((value) =>
      normalizeText(value)
    );
    const seeds = [...STRATEGIC_CLUSTER_SEEDS, ...buildDynamicSeeds({
      contentItems,
      topicHistory,
      profile,
      seedKeywords,
    })];
    const clusters = new Map<string, ContentCluster>();

    for (const seed of seeds) {
      const key = normalizeText(seed.label).replace(/\s+/g, "-");

      if (!clusters.has(key)) {
        clusters.set(key, emptyCluster(seed));
      }
    }

    const attachToCluster = (
      source: string,
      publishedAt: Date | null,
      fromHistory: boolean,
    ): void => {
      const matchedSeed = seeds
        .map((seed) => ({
          seed,
          score: scoreSeed(source, seed),
        }))
        .sort((left, right) => right.score - left.score)[0];

      if (!matchedSeed || matchedSeed.score <= 0) {
        return;
      }

      const key = normalizeText(matchedSeed.seed.label).replace(/\s+/g, "-");
      const cluster = clusters.get(key);

      if (!cluster) {
        return;
      }

      cluster.articleTitles.push(source);
      cluster.totalCount += 1;

      if (fromHistory) {
        cluster.historyCount += 1;
      }

      if (publishedAt && publishedAt.getTime() >= recentThreshold) {
        cluster.recentCount += 1;
      }

      if (!cluster.lastPublishedAt || (publishedAt && publishedAt > cluster.lastPublishedAt)) {
        cluster.lastPublishedAt = publishedAt;
      }

      const normalizedSource = normalizeText(source);
      cluster.serviceMatches += serviceTerms.filter((term) => normalizedSource.includes(term))
        .length;
      cluster.preferredMatches += preferredTerms.filter((term) =>
        normalizedSource.includes(term)
      ).length;
    };

    for (const contentItem of contentItems) {
      const title = contentItem.title?.trim();

      if (!title) {
        continue;
      }

      const taxonomies = [
        ...extractTaxonomyNames(contentItem.metadata.categories),
        ...extractTaxonomyNames(contentItem.metadata.tags),
      ];
      attachToCluster(
        `${title} ${taxonomies.join(" ")}`.trim(),
        extractPublishedAt(contentItem),
        false,
      );
    }

    for (const historyItem of topicHistory) {
      attachToCluster(historyItem.topic, historyItem.publishedAt ?? historyItem.updatedAt, true);
    }

    return [...clusters.values()]
      .filter((cluster) => cluster.totalCount > 0 || cluster.keywords.length > 0)
      .sort((left, right) => {
        if (right.totalCount !== left.totalCount) {
          return right.totalCount - left.totalCount;
        }

        return right.recentCount - left.recentCount;
      });
  },
});
