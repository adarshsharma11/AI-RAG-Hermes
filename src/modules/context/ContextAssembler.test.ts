import { describe, expect, it } from "vitest";

import { splitIntoChunks, trimContextDocuments } from "./ContextAssembler.js";

const createWords = (count: number): string =>
  Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ");

describe("ContextAssembler", () => {
  it("splits long content into approximately 500 to 800 word chunks", () => {
    const chunks = splitIntoChunks(createWords(1400));

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks.slice(0, 2)) {
      const wordCount = chunk.split(" ").filter(Boolean).length;
      expect(wordCount).toBeGreaterThanOrEqual(500);
      expect(wordCount).toBeLessThanOrEqual(800);
    }
  });

  it("trims assembled documents to the requested character budget", () => {
    const result = trimContextDocuments(
      [
        {
          id: "content-1",
          title: "Kitchen Cabinet Hardware",
          url: "https://example.com/cabinet-hardware",
          score: 0.95,
          excerpt: "Hardware trends overview.".repeat(20),
          context: "Knobs, pulls, finishes, and installation tips. ".repeat(80),
          metadata: {},
        },
        {
          id: "content-2",
          title: "Drawer Pull Guide",
          url: "https://example.com/drawer-pull-guide",
          score: 0.9,
          excerpt: "Guide excerpt.".repeat(20),
          context: "Handle sizing recommendations for kitchens. ".repeat(70),
          metadata: {},
        },
      ],
      {
        maxCharacters: 1200,
        maxChunks: 2,
      },
    );

    expect(result.totalCharacters).toBeLessThanOrEqual(1200);
    expect(result.documents.length).toBeGreaterThan(0);
    expect(result.documents.every((document) => document.context.length > 0)).toBe(
      true,
    );
    expect(result.trimmingRatio).toBeLessThan(1);
  });
});
