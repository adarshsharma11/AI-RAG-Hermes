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

export const createOutlinePlannerService = (): OutlinePlannerService => ({
  plan: ({
    topic,
    primaryKeyword,
    secondaryKeywords,
    faqKeywords,
    searchIntent,
  }) => {
    const supportingKeywords = secondaryKeywords.slice(0, 6);
    const faqSections = faqKeywords.slice(0, 2);
    const introLabel =
      searchIntent === "Transactional"
        ? "When To Hire a Pro"
        : searchIntent === "Commercial"
          ? "How To Compare Options"
          : "What You Need To Know";

    return [
      {
        heading: titleCase(`${topic}: ${introLabel}`),
        subheadings: [
          titleCase(`Why ${primaryKeyword} matters`),
          titleCase(`Who benefits most from ${primaryKeyword}`),
        ],
      },
      {
        heading: titleCase(`Core Factors That Shape ${primaryKeyword}`),
        subheadings: supportingKeywords.slice(0, 2).map((keyword) =>
          titleCase(`How ${keyword} influences results`)
        ),
      },
      {
        heading: titleCase(`Common Mistakes To Avoid With ${primaryKeyword}`),
        subheadings: [
          titleCase(`Planning mistakes homeowners make`),
          titleCase(`Quality issues to catch early`),
        ],
      },
      {
        heading: titleCase(`Best Practices For ${primaryKeyword}`),
        subheadings: supportingKeywords.slice(2, 4).map((keyword) =>
          titleCase(`Best practices for ${keyword}`)
        ),
      },
      {
        heading: titleCase(`How To Evaluate Your Options`),
        subheadings: [
          titleCase(`Questions to ask before choosing`),
          titleCase(`How to compare cost, quality, and fit`),
        ],
      },
      {
        heading: titleCase(`Internal Resources And Related Reading`),
        subheadings: supportingKeywords.slice(4, 6).map((keyword) =>
          titleCase(`Related guidance on ${keyword}`)
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
