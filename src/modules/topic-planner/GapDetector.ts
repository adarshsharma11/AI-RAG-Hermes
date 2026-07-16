import type {
  ContentItemRecord,
  ProjectProfileRecord,
  TopicHistoryRecord,
} from "../../database/schema/index.js";
import type { ContentCluster } from "./ContentClusterAnalyzer.js";

export type PlanningSearchIntent =
  | "Informational"
  | "Commercial"
  | "Transactional"
  | "Navigational";

export type PlanningBusinessIntent =
  | "Awareness"
  | "Evaluation"
  | "Conversion";

export interface ClusterGap {
  clusterKey: string;
  clusterLabel: string;
  anchor: string;
  semanticGap: number;
  seoOpportunity: number;
  businessValue: number;
  serviceRelevance: number;
  freshness: number;
  clusterDiversity: number;
  publishingFrequency: number;
  searchIntent: PlanningSearchIntent;
  businessIntent: PlanningBusinessIntent;
}

export interface PlanningGapAnalysis {
  existingTopics: string[];
  recentTopics: string[];
  historicalTopics: string[];
  historicalSlugs: string[];
  historicalPrimaryKeywords: string[];
  avoidTopics: string[];
  preferredTopics: string[];
  services: string[];
  audiences: string[];
  industries: string[];
  keywords: string[];
  clusters: ContentCluster[];
  gaps: ClusterGap[];
}

export interface GapDetector {
  detect(input: {
    clusters: ContentCluster[];
    contentItems: ContentItemRecord[];
    topicHistory: TopicHistoryRecord[];
    profile?: ProjectProfileRecord | null | undefined;
    seedKeywords?: string[] | undefined;
  }): PlanningGapAnalysis;
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

const uniqueNormalized = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => normalizeText(value)).filter((value) => value.length >= 3))];

const inferSearchIntent = (anchor: string): PlanningSearchIntent => {
  if (/(roi|comparison|vs|best)/.test(anchor)) {
    return "Commercial";
  }

  if (/(implementation|roadmap|rollout|service)/.test(anchor)) {
    return "Transactional";
  }

  if (/(brand|portal|contact)/.test(anchor)) {
    return "Navigational";
  }

  return "Informational";
};

const inferBusinessIntent = (anchor: string): PlanningBusinessIntent => {
  if (/(implementation|roadmap|service|migration)/.test(anchor)) {
    return "Conversion";
  }

  if (/(roi|comparison|framework|checklist)/.test(anchor)) {
    return "Evaluation";
  }

  return "Awareness";
};

export const createGapDetector = (): GapDetector => ({
  detect: ({
    clusters,
    contentItems,
    topicHistory,
    profile,
    seedKeywords = [],
  }) => {
    const existingTopics = contentItems
      .map((item) => item.title?.trim() ?? "")
      .filter(Boolean);
    const recentTopics = contentItems
      .filter((item) => {
        const publishedAt = item.metadata.publishedAt ?? item.metadata.published_at;

        if (typeof publishedAt !== "string") {
          return false;
        }

        const parsed = new Date(publishedAt);
        return !Number.isNaN(parsed.getTime()) &&
          parsed.getTime() >= Date.now() - 1000 * 60 * 60 * 24 * 120;
      })
      .map((item) => item.title?.trim() ?? "")
      .filter(Boolean);
    const historicalTopics = topicHistory.map((item) => item.topic);
    const historicalSlugs = topicHistory.map((item) => item.slug);
    const historicalPrimaryKeywords = topicHistory.map((item) => item.primaryKeyword);
    const preferredTopics = uniqueNormalized(profile?.preferredTopics ?? []);
    const avoidTopics = uniqueNormalized(profile?.avoidTopics ?? []);
    const services = uniqueNormalized(profile?.services ?? []);
    const audiences = uniqueNormalized(profile?.targetAudience ?? []);
    const industries = uniqueNormalized(profile?.industry ? [profile.industry] : []);
    const keywords = uniqueNormalized([
      ...seedKeywords,
      ...(profile?.seedKeywords ?? []),
      ...(profile?.seoFocus ?? []),
      ...services,
      ...preferredTopics,
    ]);
    const maxCount = Math.max(1, ...clusters.map((cluster) => cluster.totalCount));
    const maxRecent = Math.max(1, ...clusters.map((cluster) => cluster.recentCount));
    const averageCount =
      clusters.length === 0
        ? 0
        : clusters.reduce((total, cluster) => total + cluster.totalCount, 0) /
          clusters.length;
    const targetClusters = uniqueNormalized([
      ...preferredTopics,
      ...services,
      ...keywords,
      ...clusters.map((cluster) => cluster.label),
    ]);
    const gapMap = new Map<string, ClusterGap>();

    for (const cluster of clusters) {
      const normalizedAnchor = normalizeText(cluster.anchor);
      const semanticGap = Number(
        Math.max(0, 1 - cluster.recentCount / Math.max(1, cluster.totalCount)).toFixed(4),
      );
      const clusterDiversity = Number(
        Math.max(0.2, 1 - cluster.totalCount / Math.max(maxCount, averageCount || 1)).toFixed(4),
      );
      const publishingFrequency = Number(
        Math.min(1, cluster.recentCount / maxRecent).toFixed(4),
      );
      const serviceRelevance = Number(
        Math.min(
          1,
          0.35 +
            cluster.serviceMatches * 0.08 +
            services.filter((service) => normalizedAnchor.includes(service)).length * 0.18,
        ).toFixed(4),
      );
      const seoOpportunity = Number(
        Math.min(
          1,
          0.42 +
            (normalizedAnchor.split(" ").length >= 2 ? 0.18 : 0.05) +
            (cluster.historyCount === 0 ? 0.12 : 0) +
            (cluster.recentCount === 0 ? 0.18 : 0),
        ).toFixed(4),
      );
      const businessValue = Number(
        Math.min(
          1,
          0.45 +
            cluster.preferredMatches * 0.1 +
            cluster.serviceMatches * 0.08 +
            (preferredTopics.some((topic) => normalizedAnchor.includes(topic)) ? 0.12 : 0),
        ).toFixed(4),
      );
      const freshness = Number(
        Math.min(
          1,
          0.35 +
            (cluster.lastPublishedAt &&
            cluster.lastPublishedAt.getTime() < Date.now() - 1000 * 60 * 60 * 24 * 180
              ? 0.3
              : 0.1) +
            (cluster.recentCount === 0 ? 0.2 : 0),
        ).toFixed(4),
      );

      gapMap.set(cluster.key, {
        clusterKey: cluster.key,
        clusterLabel: cluster.label,
        anchor: titleCase(cluster.anchor),
        semanticGap,
        seoOpportunity,
        businessValue,
        serviceRelevance,
        freshness,
        clusterDiversity,
        publishingFrequency,
        searchIntent: inferSearchIntent(normalizedAnchor),
        businessIntent: inferBusinessIntent(normalizedAnchor),
      });
    }

    for (const target of targetClusters) {
      const existingCluster = clusters.find((cluster) =>
        normalizeText(cluster.label).includes(target) ||
        normalizeText(cluster.anchor).includes(target)
      );

      if (existingCluster) {
        continue;
      }

      const key = target.replace(/\s+/g, "-");

      gapMap.set(key, {
        clusterKey: key,
        clusterLabel: titleCase(target),
        anchor: titleCase(target),
        semanticGap: 1,
        seoOpportunity: 0.82,
        businessValue: services.some((service) => target.includes(service)) ? 0.9 : 0.72,
        serviceRelevance: services.some((service) => target.includes(service)) ? 0.95 : 0.58,
        freshness: 0.9,
        clusterDiversity: 0.92,
        publishingFrequency: 0,
        searchIntent: inferSearchIntent(target),
        businessIntent: inferBusinessIntent(target),
      });
    }

    return {
      existingTopics,
      recentTopics,
      historicalTopics,
      historicalSlugs,
      historicalPrimaryKeywords,
      avoidTopics,
      preferredTopics,
      services,
      audiences,
      industries: industries.length > 0 ? industries : ["technology"],
      keywords,
      clusters,
      gaps: [...gapMap.values()]
        .sort((left, right) => {
          const leftScore =
            left.semanticGap * 0.24 +
            left.businessValue * 0.2 +
            left.seoOpportunity * 0.18 +
            left.serviceRelevance * 0.15 +
            left.freshness * 0.12 +
            left.clusterDiversity * 0.11;
          const rightScore =
            right.semanticGap * 0.24 +
            right.businessValue * 0.2 +
            right.seoOpportunity * 0.18 +
            right.serviceRelevance * 0.15 +
            right.freshness * 0.12 +
            right.clusterDiversity * 0.11;

          return rightScore - leftScore;
        })
        .slice(0, 20),
    };
  },
});
