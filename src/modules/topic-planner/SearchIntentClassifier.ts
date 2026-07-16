import type {
  ClusterGap,
  PlanningGapAnalysis,
  PlanningSearchIntent,
} from "./GapDetector.js";

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const uniqueStrings = <T extends string>(values: readonly T[]): T[] => [...new Set(values)];

export interface IntentOpportunity {
  clusterKey: string;
  clusterLabel: string;
  anchor: string;
  intent: PlanningSearchIntent;
  searchDemand: number;
  businessValue: number;
  uniqueness: number;
  conversionPotential: number;
  internalLinkOpportunity: number;
  topicalAuthority: number;
}

export interface SearchIntentClassifier {
  classify(input: { analysis: PlanningGapAnalysis }): IntentOpportunity[];
}

const inferIntentsForGap = (
  gap: ClusterGap,
  analysis: PlanningGapAnalysis,
): PlanningSearchIntent[] => {
  const normalizedAnchor = normalizeText(gap.anchor);
  const intents: PlanningSearchIntent[] = [gap.searchIntent];

  if (
    gap.businessIntent === "Conversion" ||
    /(implementation|rollout|deployment|integration|migration)/.test(normalizedAnchor)
  ) {
    intents.push("Implementation");
  }

  if (
    gap.serviceRelevance >= 0.72 ||
    /(buyer|vendor|solution|platform|tool|service|partner)/.test(normalizedAnchor)
  ) {
    intents.push("Commercial Investigation");
  }

  if (
    gap.serviceRelevance >= 0.84 ||
    /(service|partner|consulting|agency|outsourcing)/.test(normalizedAnchor)
  ) {
    intents.push("Transactional");
  }

  if (
    /(comparison|compare|vs|versus|alternative|roi)/.test(normalizedAnchor) ||
    gap.businessIntent === "Evaluation"
  ) {
    intents.push("Comparison");
  }

  if (
    /(strategy|roadmap|governance|leadership|planning|enterprise)/.test(normalizedAnchor) ||
    analysis.audiences.some((audience) => /(leader|executive|director|vp|cfo|cio|cto)/.test(audience))
  ) {
    intents.push("Strategic Planning");
  }

  intents.push("Informational");

  return uniqueStrings(intents);
};

const scoreSearchDemand = (
  gap: ClusterGap,
  intent: PlanningSearchIntent,
): number => {
  const intentBonus =
    intent === "Comparison"
      ? 0.18
      : intent === "Commercial Investigation"
        ? 0.16
        : intent === "Strategic Planning"
          ? 0.14
          : intent === "Implementation"
            ? 0.13
            : intent === "Transactional"
              ? 0.1
              : 0.08;

  return Number(
    Math.min(
      1,
      0.42 +
        gap.seoOpportunity * 0.35 +
        gap.semanticGap * 0.12 +
        intentBonus,
    ).toFixed(4),
  );
};

const scoreConversionPotential = (
  gap: ClusterGap,
  intent: PlanningSearchIntent,
): number => {
  const intentBonus =
    intent === "Transactional"
      ? 0.28
      : intent === "Implementation"
        ? 0.24
        : intent === "Commercial Investigation"
          ? 0.2
          : intent === "Comparison"
            ? 0.16
            : intent === "Strategic Planning"
              ? 0.14
              : 0.08;

  return Number(
    Math.min(
      1,
      0.3 +
        gap.businessValue * 0.28 +
        gap.serviceRelevance * 0.22 +
        intentBonus,
    ).toFixed(4),
  );
};

const scoreTopicalAuthority = (
  gap: ClusterGap,
  analysis: PlanningGapAnalysis,
): number => {
  const cluster = analysis.clusters.find((candidate) => candidate.key === gap.clusterKey);
  const existingCoverage = cluster
    ? Math.min(0.32, cluster.totalCount * 0.08 + cluster.historyCount * 0.04)
    : 0.05;

  return Number(
    Math.min(
      1,
      0.28 +
        existingCoverage +
        gap.serviceRelevance * 0.22 +
        gap.businessValue * 0.18,
    ).toFixed(4),
  );
};

export const createSearchIntentClassifier = (): SearchIntentClassifier => ({
  classify: ({ analysis }) =>
    analysis.gaps
      .flatMap((gap) =>
        inferIntentsForGap(gap, analysis).map((intent): IntentOpportunity => ({
          clusterKey: gap.clusterKey,
          clusterLabel: gap.clusterLabel,
          anchor: gap.anchor,
          intent,
          searchDemand: scoreSearchDemand(gap, intent),
          businessValue: gap.businessValue,
          uniqueness: Number(
            Math.min(1, 0.35 + gap.semanticGap * 0.45 + gap.clusterDiversity * 0.2).toFixed(4),
          ),
          conversionPotential: scoreConversionPotential(gap, intent),
          internalLinkOpportunity: Number(
            Math.min(
              1,
              0.3 + gap.clusterDiversity * 0.25 + gap.serviceRelevance * 0.2 + gap.freshness * 0.1,
            ).toFixed(4),
          ),
          topicalAuthority: scoreTopicalAuthority(gap, analysis),
        })),
      )
      .sort((left, right) => {
        const leftScore =
          left.searchDemand * 0.28 +
          left.businessValue * 0.2 +
          left.conversionPotential * 0.18 +
          left.topicalAuthority * 0.17 +
          left.uniqueness * 0.1 +
          left.internalLinkOpportunity * 0.07;
        const rightScore =
          right.searchDemand * 0.28 +
          right.businessValue * 0.2 +
          right.conversionPotential * 0.18 +
          right.topicalAuthority * 0.17 +
          right.uniqueness * 0.1 +
          right.internalLinkOpportunity * 0.07;

        return rightScore - leftScore;
      })
      .slice(0, 30),
});
