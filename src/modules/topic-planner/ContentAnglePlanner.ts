import type { TopicHistoryRecord } from "../../database/schema/index.js";
import type { PlanningGapAnalysis } from "./GapDetector.js";

export type ContentAngle =
  | "Problem"
  | "Mistakes"
  | "Checklist"
  | "Framework"
  | "Guide"
  | "Roadmap"
  | "ROI"
  | "Comparison"
  | "Best Practices"
  | "Case Study"
  | "FAQ"
  | "Trends"
  | "Predictions"
  | "Security"
  | "Governance"
  | "Implementation"
  | "Buyer Guide";

export interface ContentAngleOpportunity {
  clusterKey: string;
  clusterLabel: string;
  anchor: string;
  service: string;
  contentAngle: ContentAngle;
  serviceWeight: number;
  editorialDiversity: number;
  titlePattern: string;
  businessValue: number;
  internalLinkOpportunity: number;
  topicalAuthority: number;
}

export interface ContentAnglePlanner {
  plan(input: {
    analysis: PlanningGapAnalysis;
    topicHistory: TopicHistoryRecord[];
  }): ContentAngleOpportunity[];
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

const uniqueStrings = <T extends string>(values: readonly T[]): T[] => [...new Set(values)];

const inferAngle = (topic: string): ContentAngle | null => {
  const normalized = normalizeText(topic);

  if (/(buyer guide|buyer|vendor|selection criteria)/.test(normalized)) {
    return "Buyer Guide";
  }
  if (/(implementation|rollout|deployment|migration)/.test(normalized)) {
    return "Implementation";
  }
  if (/(governance|policy|guardrail)/.test(normalized)) {
    return "Governance";
  }
  if (/(security|risk|compliance)/.test(normalized)) {
    return "Security";
  }
  if (/(prediction|forecast|future)/.test(normalized)) {
    return "Predictions";
  }
  if (/(trend|trends)/.test(normalized)) {
    return "Trends";
  }
  if (/(faq|questions)/.test(normalized)) {
    return "FAQ";
  }
  if (/(case study|success story|example)/.test(normalized)) {
    return "Case Study";
  }
  if (/(best practices|best practice)/.test(normalized)) {
    return "Best Practices";
  }
  if (/(comparison|compare|vs|versus|alternative)/.test(normalized)) {
    return "Comparison";
  }
  if (/(roi|return on investment|business case)/.test(normalized)) {
    return "ROI";
  }
  if (/(roadmap|plan)/.test(normalized)) {
    return "Roadmap";
  }
  if (/(guide|how to)/.test(normalized)) {
    return "Guide";
  }
  if (/(framework|model)/.test(normalized)) {
    return "Framework";
  }
  if (/(checklist|criteria)/.test(normalized)) {
    return "Checklist";
  }
  if (/(mistakes|errors|wrong)/.test(normalized)) {
    return "Mistakes";
  }
  if (/(problem|challenge|bottleneck)/.test(normalized)) {
    return "Problem";
  }

  return null;
};

const buildTitlePattern = (angle: ContentAngle): string => {
  switch (angle) {
    case "Problem":
      return "problem-explainer";
    case "Mistakes":
      return "mistakes-to-avoid";
    case "Checklist":
      return "checklist";
    case "Framework":
      return "framework";
    case "Guide":
      return "guide";
    case "Roadmap":
      return "roadmap";
    case "ROI":
      return "roi";
    case "Comparison":
      return "comparison";
    case "Best Practices":
      return "best-practices";
    case "Case Study":
      return "case-study";
    case "FAQ":
      return "faq";
    case "Trends":
      return "trends";
    case "Predictions":
      return "predictions";
    case "Security":
      return "security";
    case "Governance":
      return "governance";
    case "Implementation":
      return "implementation";
    case "Buyer Guide":
      return "buyer-guide";
  }
};

const inferAnglesForGap = (anchor: string, clusterLabel: string): ContentAngle[] => {
  const normalized = normalizeText(`${anchor} ${clusterLabel}`);
  const angles: ContentAngle[] = ["Guide", "Framework"];

  if (/(security|risk|compliance)/.test(normalized)) {
    angles.push("Security", "Checklist", "Best Practices", "Implementation");
  }
  if (/(governance|policy|guardrail)/.test(normalized)) {
    angles.push("Governance", "Framework", "Roadmap", "FAQ");
  }
  if (/(implementation|deployment|rollout|migration)/.test(normalized)) {
    angles.push("Implementation", "Checklist", "Mistakes", "Case Study");
  }
  if (/(roi|cost|business case)/.test(normalized)) {
    angles.push("ROI", "Comparison", "Buyer Guide");
  }
  if (/(strategy|planning|roadmap|enterprise)/.test(normalized)) {
    angles.push("Roadmap", "Predictions", "Trends", "Problem");
  }

  angles.push(
    "Comparison",
    "Best Practices",
    "Checklist",
    "Mistakes",
    "Buyer Guide",
  );

  return uniqueStrings(angles);
};

const matchesService = (topic: string, service: string): boolean => {
  const normalizedTopic = normalizeText(topic);
  const normalizedService = normalizeText(service);
  return normalizedTopic.includes(normalizedService) || normalizedService.includes(normalizedTopic);
};

export const createContentAnglePlanner = (): ContentAnglePlanner => ({
  plan: ({ analysis, topicHistory }) => {
    const servicePool = analysis.services.length > 0
      ? analysis.services
      : uniqueStrings(analysis.gaps.map((gap) => normalizeText(gap.anchor)));
    const latestTopics = topicHistory.slice(0, 6).map((item) => item.topic);
    const latestService = latestTopics.find(Boolean)
      ? servicePool.find((service) => matchesService(latestTopics[0] ?? "", service)) ?? null
      : null;
    const latestAngle = latestTopics.find(Boolean)
      ? inferAngle(latestTopics[0] ?? "")
      : null;
    const recentAngles = new Map<ContentAngle, number>();
    const recentServices = new Map<string, number>();
    const patternCounts = new Map<string, number>();

    for (const topic of [...analysis.existingTopics.slice(0, 12), ...latestTopics]) {
      const angle = inferAngle(topic);

      if (angle) {
        recentAngles.set(angle, (recentAngles.get(angle) ?? 0) + 1);
        const pattern = buildTitlePattern(angle);
        patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
      }

      for (const service of servicePool) {
        if (matchesService(topic, service)) {
          recentServices.set(service, (recentServices.get(service) ?? 0) + 1);
        }
      }
    }

    return servicePool
      .flatMap((service, index) => {
        const relatedGaps = analysis.gaps.filter((gap) =>
          normalizeText(gap.anchor).includes(service) ||
          service.includes(normalizeText(gap.anchor))
        );
        const gapPool = relatedGaps.length > 0 ? relatedGaps : analysis.gaps.slice(0, 4);
        const serviceWeight = Number(Math.max(0.35, 1 - index * 0.12).toFixed(4));

        return gapPool.flatMap((gap) => {
          const angles = inferAnglesForGap(gap.anchor, gap.clusterLabel);

          return angles.flatMap((contentAngle) => {
            const pattern = buildTitlePattern(contentAngle);

            if (latestService === service && latestAngle === contentAngle) {
              return [];
            }

            const servicePenalty = Math.min(0.45, (recentServices.get(service) ?? 0) * 0.12);
            const anglePenalty = Math.min(0.4, (recentAngles.get(contentAngle) ?? 0) * 0.11);
            const patternPenalty = Math.min(0.35, (patternCounts.get(pattern) ?? 0) * 0.09);
            const editorialDiversity = Number(
              Math.max(
                0.2,
                1 - servicePenalty - anglePenalty - patternPenalty + gap.clusterDiversity * 0.15,
              ).toFixed(4),
            );

            return [{
              clusterKey: gap.clusterKey,
              clusterLabel: gap.clusterLabel,
              anchor: titleCase(gap.anchor),
              service: titleCase(service),
              contentAngle,
              serviceWeight,
              editorialDiversity,
              titlePattern: pattern,
              businessValue: gap.businessValue,
              internalLinkOpportunity: Number(
                Math.min(1, gap.clusterDiversity * 0.35 + gap.serviceRelevance * 0.4 + 0.15).toFixed(4),
              ),
              topicalAuthority: Number(
                Math.min(1, gap.serviceRelevance * 0.4 + gap.businessValue * 0.28 + 0.22).toFixed(4),
              ),
            }];
          });
        });
      })
      .sort((left, right) => {
        const leftScore =
          left.serviceWeight * 0.34 +
          left.editorialDiversity * 0.32 +
          left.businessValue * 0.2 +
          left.internalLinkOpportunity * 0.08 +
          left.topicalAuthority * 0.06;
        const rightScore =
          right.serviceWeight * 0.34 +
          right.editorialDiversity * 0.32 +
          right.businessValue * 0.2 +
          right.internalLinkOpportunity * 0.08 +
          right.topicalAuthority * 0.06;

        return rightScore - leftScore;
      })
      .slice(0, 40);
  },
});
