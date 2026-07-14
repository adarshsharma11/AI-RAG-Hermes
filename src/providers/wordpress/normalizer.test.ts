import { describe, expect, it } from "vitest";

import { normalizeWordPressPost } from "./normalizer.js";
import type { WordPressPost, WordPressTerm } from "./types.js";

const post: WordPressPost = {
  id: "42",
  slug: "hello-world",
  titleHtml: "<h1>Hello <strong>World</strong></h1>",
  excerptHtml: "<p>Short <em>excerpt</em></p>",
  htmlContent: "<p>Hello <strong>WordPress</strong> readers.</p>",
  status: "publish",
  url: "https://example.com/hello-world",
  author: {
    id: "7",
    name: "Jane Doe",
    slug: "jane-doe",
    url: "https://example.com/author/jane-doe",
  },
  publishedAt: "2024-01-01T00:00:00",
  modifiedAt: "2024-01-02T00:00:00",
  categoryIds: ["10"],
  tagIds: ["20"],
  featuredImage: {
    id: "30",
    url: "https://example.com/image.jpg",
    altText: "Hero",
    captionHtml: "<p>Caption</p>",
  },
  seo: {
    title: "SEO title",
  },
};

const category: WordPressTerm = {
  id: "10",
  name: "News",
  slug: "news",
  taxonomy: "category",
};

const tag: WordPressTerm = {
  id: "20",
  name: "Featured",
  slug: "featured",
  taxonomy: "tag",
};

describe("normalizeWordPressPost", () => {
  it("converts a WordPress post into a content item payload", () => {
    const normalized = normalizeWordPressPost({
      projectId: "project-1",
      sourceId: "source-1",
      post,
      categories: new Map([[category.id, category]]),
      tags: new Map([[tag.id, tag]]),
    });

    expect(normalized.payload.projectId).toBe("project-1");
    expect(normalized.payload.sourceId).toBe("source-1");
    expect(normalized.payload.rawContent).toContain("<strong>WordPress</strong>");
    expect(normalized.payload.normalizedContent).toBe("Hello WordPress readers.");
    expect(normalized.payload.title).toBe("Hello World");
    expect(normalized.payload.checksum).toHaveLength(64);
    expect(normalized.payload.metadata).toMatchObject({
      slug: "hello-world",
      url: "https://example.com/hello-world",
      categories: [{ id: "10", name: "News", slug: "news" }],
      tags: [{ id: "20", name: "Featured", slug: "featured" }],
      featuredImage: {
        url: "https://example.com/image.jpg",
      },
      seo: {
        title: "SEO title",
      },
    });
    expect(normalized.sourceModifiedAt).toBe("2024-01-02T00:00:00");
  });

  it("does not change checksum when only html markup changes", () => {
    const baseline = normalizeWordPressPost({
      projectId: "project-1",
      sourceId: "source-1",
      post,
      categories: new Map([[category.id, category]]),
      tags: new Map([[tag.id, tag]]),
    });
    const htmlOnlyVariant = normalizeWordPressPost({
      projectId: "project-1",
      sourceId: "source-1",
      post: {
        ...post,
        titleHtml: '<h1><span>Hello</span> <strong>World</strong></h1>',
        excerptHtml: '<div><p>Short <em>excerpt</em></p></div>',
        htmlContent: '<section><p>Hello <strong>WordPress</strong> readers.</p></section>',
      },
      categories: new Map([[category.id, category]]),
      tags: new Map([[tag.id, tag]]),
    });

    expect(htmlOnlyVariant.payload.normalizedContent).toBe(
      baseline.payload.normalizedContent,
    );
    expect(htmlOnlyVariant.payload.checksum).toBe(baseline.payload.checksum);
  });
});
