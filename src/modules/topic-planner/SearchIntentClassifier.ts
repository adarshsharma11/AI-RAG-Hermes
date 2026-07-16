import type {
  PlanningGapAnalysis,
  PlanningSearchIntent,
} from "./GapDetector.js";
import type { ContentAngle, ContentAngleOpportunity } from "./ContentAnglePlanner.js";

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
  service: string;
  contentAngle: ContentAngle;
  titlePattern: string;
  intent: PlanningSearchIntent;
  searchDemand: number;
  businessValue: number;
  uniqueness: number;
  conversionPotential: number;
  internalLinkOpportunity: number;
  topicalAuthority: number;
  editorialDiversity: number;
}

export interface SearchIntentClassifier {
  classify(input: {
    analysis: PlanningGapAnalysis;
    anglePlans: ContentAngleOpportunity[];
  }): IntentOpportunity[];
}

const inferIntentsForAngle = (
  anglePlan: ContentAngleOpportunity,
  analysis: PlanningGapAnalysis,
): PlanningSearchIntent[] => {
  const normalizedAnchor = normalizeText(`${anglePlan.anchor} ${anglePlan.service}`);
  const intents: PlanningSearchIntent[] = [];

  switch (anglePlan.contentAngle) {
    case "Buyer Guide":
      intents.push("Commercial Investigation", "Transactional");
      break;
    case "Implementation":
      intents.push("Implementation", "Transactional");
      break;
    case "Comparison":
      intents.push("Comparison", "Commercial Investigation");
      break;
    case "ROI":
    case "Governance":
    case "Roadmap":
    case "Predictions":
    case "Trends":
      intents.push("Strategic Planning", "Informational");
      break;
    case "Checklist":
    case "Best Practices":
    case "Security":
      intents.push("Implementation", "Informational");
      break;
    case "Case Study":
      intents.push("Commercial Investigation", "Informational");
      break;
    case "FAQ":
    case "Guide":
    case "Problem":
    case "Mistakes":
      intents.push("Informational");
      break;
    case "Framework":
      intents.push("Strategic Planning", "Commercial Investigation");
      break;
  }

  if (/(buyer|vendor|solution|platform|tool|service|partner)/.test(normalizedAnchor)) {
    intents.push("Commercial Investigation");
  }
  if (/(service|partner|consulting|agency|outsourcing)/.test(normalizedAnchor)) {
    intents.push("Transactional");
  }
  if (/(comparison|compare|vs|versus|alternative|roi)/.test(normalizedAnchor)) {
    intents.push("Comparison");
  }
  if (
    /(strategy|roadmap|governance|leadership|planning|enterprise)/.test(normalizedAnchor) ||
    analysis.audiences.some((audience) => /(leader|executive|director|vp|cfo|cio|cto)/.test(audience))
  ) {
    intents.push("Strategic Planning");
  }
  if (/(implementation|rollout|deployment|integration|migration)/.test(normalizedAnchor)) {
    intents.push("Implementation");
  }
  intents.push("Informational");

  return uniqueStrings(intents);
};

const scoreSearchDemand = (
  anglePlan: ContentAngleOpportunity,
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
        anglePlan.businessValue * 0.18 +
        anglePlan.editorialDiversity * 0.12 +
        intentBonus,
    ).toFixed(4),
  );
};

const scoreConversionPotential = (
  anglePlan: ContentAngleOpportunity,
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
        anglePlan.businessValue * 0.24 +
        anglePlan.serviceWeight * 0.18 +
        intentBonus,
    ).toFixed(4),
  );
};

const scoreTopicalAuthority = (
  anglePlan: ContentAngleOpportunity,
  analysis: PlanningGapAnalysis,
): number => {
  const cluster = analysis.clusters.find((candidate) => candidate.key === anglePlan.clusterKey);
  const existingCoverage = cluster
    ? Math.min(0.32, cluster.totalCount * 0.08 + cluster.historyCount * 0.04)
    : 0.05;

  return Number(
    Math.min(
      1,
      0.28 +
        existingCoverage +
        anglePlan.serviceWeight * 0.2 +
        anglePlan.businessValue * 0.18,
    ).toFixed(4),
  );
};

export const createSearchIntentClassifier = (): SearchIntentClassifier => ({
  classify: ({ analysis, anglePlans }) =>
    anglePlans
      .flatMap((anglePlan) =>
        inferIntentsForAngle(anglePlan, analysis).map((intent): IntentOpportunity => ({
          clusterKey: anglePlan.clusterKey,
          clusterLabel: anglePlan.clusterLabel,
          anchor: anglePlan.anchor,
          service: anglePlan.service,
          contentAngle: anglePlan.contentAngle,
          titlePattern: anglePlan.titlePattern,
          intent,
          searchDemand: scoreSearchDemand(anglePlan, intent),
          businessValue: anglePlan.businessValue,
          uniqueness: Number(
            Math.min(
              1,
              0.32 + anglePlan.editorialDiversity * 0.38 + anglePlan.serviceWeight * 0.3,
            ).toFixed(4),
          ),
          conversionPotential: scoreConversionPotential(anglePlan, intent),
          internalLinkOpportunity: Number(
            Math.min(
              1,
              0.28 + anglePlan.internalLinkOpportunity * 0.55 + anglePlan.editorialDiversity * 0.12,
            ).toFixed(4),
          ),
          topicalAuthority: scoreTopicalAuthority(anglePlan, analysis),
          editorialDiversity: anglePlan.editorialDiversity,
        })),
      )
      .sort((left, right) => {
        const leftScore =
          left.searchDemand * 0.28 +
          left.businessValue * 0.2 +
          left.conversionPotential * 0.18 +
          left.topicalAuthority * 0.17 +
          left.uniqueness * 0.09 +
          left.editorialDiversity * 0.05 +
          left.internalLinkOpportunity * 0.03;
        const rightScore =
          right.searchDemand * 0.28 +
          right.businessValue * 0.2 +
          right.conversionPotential * 0.18 +
          right.topicalAuthority * 0.17 +
          right.uniqueness * 0.09 +
          right.editorialDiversity * 0.05 +
          right.internalLinkOpportunity * 0.03;

        return rightScore - leftScore;
      })
      .slice(0, 30),
});
