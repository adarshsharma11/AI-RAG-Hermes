import type { SearchIntent } from "./SeoPlannerService.js";

export interface RecommendedOutlineSection {
  heading: string;
  subheadings: string[];
}

export interface OutlinePlannerService {
  plan(input: {
    topic: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    faqKeywords: string[];
    searchIntent: SearchIntent;
  }): RecommendedOutlineSection[];
}

const titleCase = (value: string): string =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const inferBusinessIntent = (
  topic: string,
  primaryKeyword: string,
): "Awareness" | "Evaluation" | "Conversion" => {
  const normalized = `${topic} ${primaryKeyword}`.toLowerCase();

  if (/(implementation|rollout|deployment|migration|roadmap)/.test(normalized)) {
    return "Conversion";
  }

  if (/(roi|comparison|checklist|framework|best practices)/.test(normalized)) {
    return "Evaluation";
  }

  return "Awareness";
};

export const createOutlinePlannerService = (): OutlinePlannerService => ({
  plan: ({
    topic,
    primaryKeyword,
    secondaryKeywords,
    faqKeywords,
    searchIntent,
  }) => {
    const businessIntent = inferBusinessIntent(topic, primaryKeyword);
    const supportingKeywords = secondaryKeywords.slice(0, 6);
    const faqSections = faqKeywords.slice(0, 2);
    const introductionHeading =
      businessIntent === "Conversion"
        ? `How To Operationalize ${primaryKeyword}`
        : businessIntent === "Evaluation"
          ? `How To Evaluate ${primaryKeyword}`
          : `Why ${primaryKeyword} Matters`;
    const proofHeading =
      searchIntent === "Commercial"
        ? "How Leaders Compare The Options"
        : searchIntent === "Transactional"
          ? "What A Successful Rollout Requires"
          : "What Strong Execution Looks Like";
    const decisionHeading =
      businessIntent === "Conversion"
        ? "Implementation Roadmap"
        : businessIntent === "Evaluation"
          ? "Decision Framework"
          : "Strategy And Best Practices";

    return [
      {
        heading: titleCase(introductionHeading),
        subheadings: [
          titleCase(`Business context behind ${primaryKeyword}`),
          titleCase(`Who should prioritize ${primaryKeyword} now`),
        ],
      },
      {
        heading: titleCase(proofHeading),
        subheadings: supportingKeywords.slice(0, 2).map((keyword) =>
          titleCase(`How ${keyword} shapes outcomes`)
        ),
      },
      {
        heading: titleCase(decisionHeading),
        subheadings: [
          titleCase(`How to sequence priorities and ownership`),
          titleCase(`Metrics to track during execution`),
        ],
      },
      {
        heading: titleCase(`Common Mistakes That Undermine ${primaryKeyword}`),
        subheadings: supportingKeywords.slice(2, 4).map((keyword) =>
          titleCase(`Mistakes teams make with ${keyword}`)
        ),
      },
      {
        heading: titleCase(`How To Build Internal Alignment`),
        subheadings: [
          titleCase(`Stakeholders and approval checkpoints to involve`),
          titleCase(`How to connect the topic to business outcomes`),
        ],
      },
      {
        heading: titleCase(`Internal Links And Supporting Resources`),
        subheadings: supportingKeywords.slice(4, 6).map((keyword) =>
          titleCase(`Supporting guidance on ${keyword}`)
        ),
      },
      {
        heading: titleCase(`Frequently Asked Questions About ${primaryKeyword}`),
        subheadings: faqSections.map((faq) => titleCase(faq)),
      },
    ]
      .map((section) => ({
        heading: section.heading,
        subheadings: section.subheadings.filter(Boolean).slice(0, 3),
      }))
      .slice(0, 8);
  },
});
