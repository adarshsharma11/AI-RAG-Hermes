import type {
  ClusterGap,
  PlanningGapAnalysis,
} from "./GapDetector.js";

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

const TOPIC_PATTERNS = [
  (service: string, audience: string, industry: string) =>
    `${service} Guide for ${audience} in ${industry}`,
  (service: string, audience: string) => `${service} Checklist for ${audience}`,
  (service: string, audience: string, industry: string) =>
    `${service} Framework for ${industry} ${audience}`,
  (service: string, audience: string) => `${service} Roadmap for ${audience}`,
  (service: string, audience: string) => `${service} Best Practices for ${audience}`,
  (service: string, audience: string, industry: string) =>
    `${service} ROI for ${industry} ${audience}`,
  (service: string, audience: string) => `${service} Comparison for ${audience}`,
  (service: string, audience: string, industry: string) =>
    `${service} Implementation Strategy for ${industry} ${audience}`,
  (service: string, audience: string) => `${service} Mistakes ${audience} Should Avoid`,
  (service: string, audience: string) => `${service} Strategy for ${audience}`,
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
  clusterDiversity: number;
  freshness: number;
  recentPublishingFrequency: number;
  duplicateScore: number;
}

export interface TopicGenerator {
  generateCandidates(input: {
    analysis: PlanningGapAnalysis;
    seedKeywords?: string[] | undefined;
    limit: number;
    offset?: number | undefined;
  }): TopicCandidate[];
}

const tokenize = (value: string): string[] =>
  normalizeText(value).split(" ").filter((part) => part.length >= 3);

const computeSemanticUniqueness = (
  topic: string,
  existingTopics: readonly string[],
  historicalTopics: readonly string[],
): number => {
  const topicTokens = new Set(tokenize(topic));

  if (topicTokens.size === 0 || (existingTopics.length === 0 && historicalTopics.length === 0)) {
    return 1;
  }

  let maxOverlap = 0;

  for (const existingTopic of [...existingTopics, ...historicalTopics]) {
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

const createCandidate = (
  input: {
    topic: string;
    category: string | null;
    analysis: PlanningGapAnalysis;
    gap: ClusterGap;
  },
): TopicCandidate => ({
  topic: input.topic,
  category: input.category,
  semanticUniqueness: computeSemanticUniqueness(
    input.topic,
    input.analysis.existingTopics,
    input.analysis.historicalTopics,
  ),
  semanticGap: input.gap.semanticGap,
  businessValue: input.gap.businessValue,
  seoOpportunity: input.gap.seoOpportunity,
  serviceRelevance: computeServiceRelevance(
    input.topic,
    input.analysis.services.length > 0 ? input.analysis.services : input.analysis.keywords,
  ),
  internalLinkOpportunity: Number(
    Math.min(
      1,
      0.45 +
        input.gap.clusterDiversity * 0.25 +
        (input.analysis.clusters.some((cluster) => cluster.key === input.gap.clusterKey)
          ? 0.15
          : 0.05),
    ).toFixed(4),
  ),
  clusterDiversity: input.gap.clusterDiversity,
  freshness: input.gap.freshness,
  recentPublishingFrequency: input.gap.publishingFrequency,
  duplicateScore: 0,
});

export const createTopicGenerator = (): TopicGenerator => ({
  generateCandidates: ({ analysis, seedKeywords = [], limit, offset = 0 }) => {
    const normalizedExistingTopics = new Set(
      [...analysis.existingTopics, ...analysis.historicalTopics].map((topic) =>
        normalizeText(topic)
      ),
    );
    const normalizedSeedKeywords = [
      ...analysis.keywords,
      ...seedKeywords.map((keyword) => normalizeText(keyword)),
    ]
      .filter(Boolean);
    const avoidTopics = new Set(analysis.avoidTopics);
    const candidates: TopicCandidate[] = [];
    const seen = new Set<string>();
    const services = analysis.services.length > 0
      ? analysis.services
      : analysis.gaps.map((gap) => normalizeText(gap.anchor)).slice(0, 8);
    const audiences = analysis.audiences.length > 0
      ? analysis.audiences
      : ["technical teams", "operations leaders", "executive stakeholders"];
    const industries = analysis.industries.length > 0 ? analysis.industries : ["technology"];

    const isBlockedTopic = (topic: string): boolean => {
      const normalizedTopic = normalizeText(topic);
      const normalizedSlug = normalizedTopic.split(" ").filter(Boolean).join("-");

      return (
        normalizedTopic.length === 0 ||
        normalizedExistingTopics.has(normalizedTopic) ||
        seen.has(normalizedTopic) ||
        avoidTopics.has(normalizedTopic) ||
        analysis.historicalSlugs.some((slug) => slug === normalizedSlug) ||
        analysis.historicalPrimaryKeywords.some((keyword) =>
          normalizedTopic.includes(normalizeText(keyword))
        )
      );
    };

    for (const preferredTopic of analysis.preferredTopics) {
      const topic = titleCase(preferredTopic);

      if (isBlockedTopic(topic)) {
        continue;
      }

      seen.add(normalizeText(topic));
      candidates.push(
        createCandidate({
          topic,
          category: null,
          analysis,
          gap: {
            clusterKey: normalizeText(preferredTopic).replace(/\s+/g, "-"),
            clusterLabel: titleCase(preferredTopic),
            anchor: titleCase(preferredTopic),
            semanticGap: 0.95,
            seoOpportunity: 0.82,
            businessValue: 0.88,
            serviceRelevance: 0.8,
            freshness: 0.9,
            clusterDiversity: 0.85,
            publishingFrequency: 0,
            searchIntent: "Informational",
            businessIntent: "Evaluation",
          },
        }),
      );
    }

    const anchors = [
      ...analysis.gaps.map((gap) => gap.anchor),
      ...services,
      ...normalizedSeedKeywords.map((keyword) => titleCase(keyword)),
    ].slice(0, 12);

    for (const gap of analysis.gaps) {
      const anchorPool = uniqueStrings([gap.anchor, ...anchors]).slice(0, 12);

      for (const anchor of anchorPool) {
        for (const service of services.slice(0, 8)) {
          for (const audience of audiences.slice(0, 4)) {
            for (const industry of industries.slice(0, 3)) {
              for (const pattern of TOPIC_PATTERNS) {
                const topic = titleCase(
                  pattern(
                    uniqueStrings([service, anchor]).join(" "),
                    audience,
                    industry,
                  ),
                );

                if (isBlockedTopic(topic)) {
                  continue;
                }

                seen.add(normalizeText(topic));
                candidates.push(
                  createCandidate({
                    topic,
                    category: gap.clusterLabel,
                    analysis,
                    gap,
                  }),
                );

                if (candidates.length >= 100 + offset) {
                  return candidates.slice(offset, offset + limit);
                }
              }
            }
          }
        }
      }
    }

    return candidates.slice(offset, offset + limit);
  },
});

const uniqueStrings = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))];
