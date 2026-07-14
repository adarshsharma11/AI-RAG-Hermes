import { createHash } from "node:crypto";

import { htmlToText } from "html-to-text";

import type { CreateContentItemInput } from "../../database/content.repository.js";
import type { WordPressPost, WordPressTerm } from "./types.js";

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(
      /&#x([\da-f]+);/gi,
      (_match, code) => String.fromCharCode(parseInt(code, 16)),
    );

const toPlainText = (value: string): string =>
  htmlToText(value, {
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
    ],
    uppercaseHeadings: false,
    wordwrap: false,
    preserveNewlines: false,
  }).trim();

const toInlineText = (value: string): string =>
  decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

const pickTerms = (
  ids: string[],
  terms: ReadonlyMap<string, WordPressTerm>,
): Array<{ id: string; name: string; slug: string }> =>
  ids
    .map((id) => terms.get(id))
    .filter((term): term is WordPressTerm => term !== undefined)
    .map((term) => ({
      id: term.id,
      name: term.name,
      slug: term.slug,
    }));

export interface NormalizeWordPressPostOptions {
  projectId: string;
  sourceId: string;
  post: WordPressPost;
  categories: ReadonlyMap<string, WordPressTerm>;
  tags: ReadonlyMap<string, WordPressTerm>;
}

export interface NormalizedWordPressContentItem {
  sourceModifiedAt: string;
  payload: CreateContentItemInput;
}

export const normalizeWordPressPost = ({
  projectId,
  sourceId,
  post,
  categories,
  tags,
}: NormalizeWordPressPostOptions): NormalizedWordPressContentItem => {
  const plainText = toPlainText(post.htmlContent);
  const titleText = toInlineText(post.titleHtml);
  const excerptText = toPlainText(post.excerptHtml);
  const authorFingerprint = post.author
    ? {
        id: post.author.id,
        name: post.author.name,
        slug: post.author.slug,
        url: post.author.url,
      }
    : null;
  const resolvedCategories = pickTerms(post.categoryIds, categories);
  const resolvedTags = pickTerms(post.tagIds, tags);
  const metadata = {
    provider: "wordpress",
    slug: post.slug,
    excerpt: {
      html: post.excerptHtml,
      plainText: excerptText,
    },
    author: post.author,
    url: post.url,
    publishedAt: post.publishedAt,
    modifiedAt: post.modifiedAt,
    status: post.status,
    categories: resolvedCategories,
    tags: resolvedTags,
    featuredImage: post.featuredImage,
    seo: post.seo,
  } satisfies Record<string, unknown>;

  const checksum = createHash("sha256")
    .update(
      JSON.stringify({
        title: titleText,
        plainText,
        excerpt: excerptText,
        slug: post.slug,
        author: authorFingerprint,
      }),
    )
    .digest("hex");

  return {
    sourceModifiedAt: post.modifiedAt,
    payload: {
      projectId,
      sourceId,
      externalId: post.id,
      contentType: "wordpress_post",
      title: titleText || null,
      rawContent: post.htmlContent,
      normalizedContent: plainText,
      checksum,
      metadata,
    },
  };
};
