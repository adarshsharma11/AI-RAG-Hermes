import type { DuplicateDetectionResult } from "../memory/DuplicateDetector.js";

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export interface TopicValidationResult {
  valid: boolean;
  slug: string;
  issues: string[];
}

export interface TopicValidator {
  validate(input: {
    topic: string;
    existingTopics: readonly string[];
    historicalTopics?: readonly string[] | undefined;
    historicalPrimaryKeywords?: readonly string[] | undefined;
    historicalSlugs?: readonly string[] | undefined;
    duplicateDetection?: DuplicateDetectionResult | undefined;
  }): TopicValidationResult;
}

export const createTopicValidator = (): TopicValidator => ({
  validate: ({
    topic,
    existingTopics,
    historicalTopics = [],
    historicalPrimaryKeywords = [],
    historicalSlugs = [],
    duplicateDetection,
  }) => {
    const issues: string[] = [];
    const trimmedTopic = topic.trim();
    const normalizedTopic = normalizeText(trimmedTopic);
    const slug = slugify(trimmedTopic);
    const words = normalizedTopic.split(" ").filter(Boolean);
    const uniqueWords = new Set(words);
    const duplicateWordCount = words.length - uniqueWords.size;
    const normalizedExistingTopics = new Set(
      [...existingTopics, ...historicalTopics].map((entry) => normalizeText(entry)),
    );
    const normalizedHistoricalKeywords = new Set(
      historicalPrimaryKeywords.map((entry) => normalizeText(entry)),
    );
    const historicalSlugSet = new Set(
      historicalSlugs.map((entry) => slugify(entry)),
    );

    if (trimmedTopic.length < 12) {
      issues.push("TOPIC_TOO_SHORT");
    }

    if (trimmedTopic.length > 80) {
      issues.push("TOPIC_TOO_LONG");
    }

    if (words.length < 2) {
      issues.push("TOPIC_NOT_DESCRIPTIVE");
    }

    if (duplicateWordCount > 2) {
      issues.push("TOPIC_REPETITIVE");
    }

    if (slug.length < 8 || slug.length > 90) {
      issues.push("SLUG_UNSAFE");
    }

    if (!/[a-z]/i.test(trimmedTopic)) {
      issues.push("TOPIC_NOT_SEO_FRIENDLY");
    }

    if (normalizedExistingTopics.has(normalizedTopic)) {
      issues.push("TOPIC_ALREADY_EXISTS");
    }

    if (historicalSlugSet.has(slug)) {
      issues.push("TOPIC_ALREADY_PLANNED");
    }

    if (
      [...normalizedHistoricalKeywords].some((keyword) =>
        keyword.length >= 4 && normalizedTopic.includes(keyword),
      )
    ) {
      issues.push("TOPIC_HISTORY_CONFLICT");
    }

    if (duplicateDetection?.duplicate) {
      issues.push("TOPIC_DUPLICATE");
    }

    return {
      valid: issues.length === 0,
      slug,
      issues,
    };
  },
});
