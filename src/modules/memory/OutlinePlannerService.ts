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

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildQuestionSections = (input: {
  primaryKeyword: string;
  secondaryKeywords: string[];
  faqKeywords: string[];
  searchIntent: SearchIntent;
}): RecommendedOutlineSection[] => {
  const normalizedPrimary = normalizeText(input.primaryKeyword);
  const support = input.secondaryKeywords.slice(0, 4);
  const faqSections = input.faqKeywords.slice(0, 2);

  const headings =
    input.searchIntent === "Strategic Planning"
      ? [
          `What does ${normalizedPrimary} actually include?`,
          `Which business problems should leaders prioritize first?`,
          `How should teams sequence governance, data, and execution?`,
          `What budget, talent, and platform dependencies matter most?`,
          `How should teams measure ROI and risk over time?`,
          `What common planning mistakes delay results?`,
        ]
      : input.searchIntent === "Implementation"
        ? [
            `What needs to be in place before ${normalizedPrimary} starts?`,
            `How should teams scope the first implementation phase?`,
            `Which stakeholders need to own delivery and governance?`,
            `What technical blockers usually slow rollout down?`,
            `How should teams measure adoption, quality, and ROI?`,
            `What mistakes derail implementation after launch?`,
          ]
        : input.searchIntent === "Comparison"
          ? [
              `How does ${normalizedPrimary} compare with the main alternatives?`,
              `Which evaluation criteria matter most for buyers?`,
              `What tradeoffs affect cost, speed, and control?`,
              `Which option fits enterprise teams best?`,
              `How should teams validate vendor or platform claims?`,
              `What mistakes lead to the wrong comparison?`,
            ]
          : input.searchIntent === "Commercial Investigation"
            ? [
                `What should buyers evaluate before choosing ${normalizedPrimary}?`,
                `Which capabilities separate strong options from weak ones?`,
                `How should teams assess risk, integration, and support?`,
                `What pricing or delivery questions should buyers ask early?`,
                `How can teams validate real business value before committing?`,
                `What buying mistakes create downstream rework?`,
              ]
            : input.searchIntent === "Transactional"
              ? [
                  `When is the right time to start ${normalizedPrimary}?`,
                  `What should be included in project scope and success criteria?`,
                  `Which teams need to sign off before execution begins?`,
                  `How should buyers evaluate delivery partners and timelines?`,
                  `What should happen in the first 90 days after kickoff?`,
                  `What mistakes create delays or cost overruns?`,
                ]
              : [
                  `What is ${normalizedPrimary} and why does it matter now?`,
                  `Which teams benefit most from ${normalizedPrimary}?`,
                  `How does ${normalizedPrimary} work in practice?`,
                  `What are the biggest risks and tradeoffs to understand?`,
                  `How should teams apply best practices from day one?`,
                  `What common mistakes should teams avoid?`,
                ];

  return headings.map((heading, index) => ({
    heading: titleCase(heading),
    subheadings:
      index === headings.length - 1
        ? faqSections.map((faq) => titleCase(faq))
        : [
            support[index % Math.max(1, support.length)]
              ? titleCase(`Answer with examples tied to ${support[index % support.length]}`)
              : "Use specific examples, metrics, and decision criteria",
            "Connect the recommendation to business impact and execution risk",
          ].filter(Boolean),
  }));
};

export const createOutlinePlannerService = (): OutlinePlannerService => ({
  plan: ({
    topic: _topic,
    primaryKeyword,
    secondaryKeywords,
    faqKeywords,
    searchIntent,
  }) => {
    return buildQuestionSections({
      primaryKeyword,
      secondaryKeywords,
      faqKeywords,
      searchIntent,
    })
      .map((section) => ({
        heading: section.heading,
        subheadings: section.subheadings.filter(Boolean).slice(0, 3),
      }))
      .slice(0, 8);
  },
});
