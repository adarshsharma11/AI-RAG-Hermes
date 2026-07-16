import type { PlanningGapAnalysis, PlanningSearchIntent } from "./GapDetector.js";
import type { IntentOpportunity } from "./SearchIntentClassifier.js";

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

const CURRENT_YEAR = new Date().getUTCFullYear();
const LONG_TAIL_CUES =
  /\b(how|what|why|when|guide|checklist|framework|roadmap|best practices|roi|comparison|vs|implementation|strategy|plan|leader|team|mistakes)\b/;

export interface TopicCandidate {
  topic: string;
  category: string | null;
  searchIntent: PlanningSearchIntent;
  searchDemand: number;
  semanticUniqueness: number;
  businessValue: number;
  conversionPotential: number;
  internalLinkOpportunity: number;
  topicalAuthority: number;
  duplicateScore: number;
}

export interface TopicGenerator {
  generateCandidates(input: {
    analysis: PlanningGapAnalysis;
    intentOpportunities: IntentOpportunity[];
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
    opportunity: IntentOpportunity;
  },
): TopicCandidate => ({
  topic: input.topic,
  category: input.category,
  searchIntent: input.opportunity.intent,
  searchDemand: input.opportunity.searchDemand,
  semanticUniqueness: computeSemanticUniqueness(
    input.topic,
    input.analysis.existingTopics,
    input.analysis.historicalTopics,
  ),
  businessValue: Number(
    Math.min(
      1,
      input.opportunity.businessValue * 0.72 +
        computeServiceRelevance(
          input.topic,
          input.analysis.services.length > 0 ? input.analysis.services : input.analysis.keywords,
        ) *
          0.28,
    ).toFixed(4),
  ),
  conversionPotential: input.opportunity.conversionPotential,
  internalLinkOpportunity: input.opportunity.internalLinkOpportunity,
  topicalAuthority: input.opportunity.topicalAuthority,
  duplicateScore: 0,
});

const isPublishableLongTail = (topic: string): boolean => {
  const normalizedTopic = normalizeText(topic);
  const words = tokenize(topic);

  return words.length >= 4 && LONG_TAIL_CUES.test(normalizedTopic);
};

const isHeadKeywordTopic = (
  normalizedTopic: string,
  analysis: PlanningGapAnalysis,
): boolean => {
  const genericHeads = uniqueStrings([
    ...analysis.services,
    ...analysis.preferredTopics,
    ...analysis.keywords,
    ...analysis.gaps.map((gap) => normalizeText(gap.anchor)),
  ]).map((value) => normalizeText(value));

  return genericHeads.includes(normalizedTopic);
};

const composeTopicVariants = (input: {
  intent: PlanningSearchIntent;
  concept: string;
  audience: string;
  industry: string;
}): string[] => {
  const { intent, concept, audience, industry } = input;

  switch (intent) {
    case "Strategic Planning":
      return [
        `${concept} Strategy for ${audience}`,
        `${concept} Roadmap for ${CURRENT_YEAR}`,
        `How to Measure ${concept} ROI`,
        `${concept} Governance Framework for ${industry} Teams`,
      ];
    case "Implementation":
      return [
        `${concept} Implementation Checklist for ${audience}`,
        `${concept} Rollout Plan for ${industry} Teams`,
        `How to Implement ${concept} Without Slowing Delivery`,
        `${concept} Implementation Roadmap for ${audience}`,
      ];
    case "Comparison":
      return [
        `${concept} vs Traditional Automation: Which Fits ${industry} Better?`,
        `How to Compare ${concept} Options for ${audience}`,
        `${concept} Comparison Guide for ${industry} Teams`,
      ];
    case "Commercial Investigation":
      return [
        `How to Evaluate ${concept} Solutions for ${audience}`,
        `${concept} Buyer Guide for ${industry} Teams`,
        `What to Look for in ${concept} Vendors`,
      ];
    case "Transactional":
      return [
        `When to Hire a ${concept} Implementation Partner`,
        `${concept} Services: What to Expect Before You Start`,
        `How to Scope a ${concept} Project`,
      ];
    case "Informational":
    default:
      return [
        `What ${audience} Should Know About ${concept}`,
        `${concept} Best Practices for ${industry} Teams`,
        `Common ${concept} Mistakes ${audience} Should Avoid`,
      ];
  }
};

export const createTopicGenerator = (): TopicGenerator => ({
  generateCandidates: ({
    analysis,
    intentOpportunities,
    seedKeywords = [],
    limit,
    offset = 0,
  }) => {
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
    const services =
      analysis.services.length > 0
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
        !isPublishableLongTail(topic) ||
        isHeadKeywordTopic(normalizedTopic, analysis) ||
        normalizedExistingTopics.has(normalizedTopic) ||
        seen.has(normalizedTopic) ||
        avoidTopics.has(normalizedTopic) ||
        analysis.historicalSlugs.some((slug) => slug === normalizedSlug) ||
        analysis.historicalPrimaryKeywords.some((keyword) =>
          normalizedTopic.includes(normalizeText(keyword))
        )
      );
    };

    const concepts = uniqueStrings([
      ...analysis.gaps.map((gap) => gap.anchor),
      ...analysis.preferredTopics.map((topic) => titleCase(topic)),
      ...services.map((service) => titleCase(service)),
      ...normalizedSeedKeywords.map((keyword) => titleCase(keyword)),
    ]);

    for (const opportunity of intentOpportunities) {
      const conceptPool = uniqueStrings([
        titleCase(opportunity.anchor),
        ...concepts.filter((concept) =>
          normalizeText(concept).includes(normalizeText(opportunity.anchor)) ||
          normalizeText(opportunity.anchor).includes(normalizeText(concept))
        ),
      ]).slice(0, 4);

      for (const concept of conceptPool) {
        for (const audience of audiences.slice(0, 4)) {
          for (const industry of industries.slice(0, 3)) {
            for (const topicTemplate of composeTopicVariants({
              intent: opportunity.intent,
              concept,
              audience,
              industry,
            })) {
              const topic = titleCase(topicTemplate);

              if (isBlockedTopic(topic)) {
                continue;
              }

              seen.add(normalizeText(topic));
              candidates.push(
                createCandidate({
                  topic,
                  category: opportunity.clusterLabel,
                  analysis,
                  opportunity,
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

    return candidates.slice(offset, offset + limit);
  },
});

const uniqueStrings = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))];
