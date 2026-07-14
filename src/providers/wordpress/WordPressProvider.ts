import type { WordPressApiPost, WordPressApiTerm } from "./types.js";
import type {
  CreateWordPressProviderOptions,
  WordPressApiAuthor,
  WordPressApiFeaturedMedia,
  WordPressPost,
  WordPressPostPage,
  WordPressProvider,
  WordPressTerm,
} from "./types.js";

const DEFAULT_RETRY_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_WORDPRESS_PAGE_SIZE = 100;
const BASE_RETRY_DELAY_MS = 250;

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const getRetryDelay = (attempt: number): number =>
  BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);

const buildAuthorizationHeader = (
  options: CreateWordPressProviderOptions,
): string | undefined => {
  const { bearerToken, username, applicationPassword } = options.config;

  if (bearerToken) {
    return `Bearer ${bearerToken}`;
  }

  if (username && applicationPassword) {
    return `Basic ${Buffer.from(`${username}:${applicationPassword}`).toString("base64")}`;
  }

  return undefined;
};

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, "");

const toAuthor = (author: WordPressApiAuthor | undefined, fallbackId?: number) => {
  if (!author && fallbackId === undefined) {
    return null;
  }

  return {
    id: String(author?.id ?? fallbackId),
    name: author?.name ?? null,
    slug: author?.slug ?? null,
    url: author?.link ?? null,
  };
};

const toFeaturedImage = (
  media: WordPressApiFeaturedMedia | undefined,
): WordPressPost["featuredImage"] => {
  if (!media) {
    return null;
  }

  return {
    id: String(media.id),
    url: media.source_url ?? null,
    altText: media.alt_text ?? null,
    captionHtml: media.caption?.rendered ?? null,
  };
};

const toSeoMetadata = (post: WordPressApiPost): Record<string, unknown> | null => {
  if (post.yoast_head_json) {
    return post.yoast_head_json;
  }

  if (post.aioseo_meta_data) {
    return post.aioseo_meta_data;
  }

  if (post.rank_math_head) {
    return {
      rankMathHead: post.rank_math_head,
    };
  }

  return null;
};

const toPost = (post: WordPressApiPost): WordPressPost => ({
  id: String(post.id),
  slug: post.slug,
  titleHtml: post.title.rendered,
  excerptHtml: post.excerpt.rendered,
  htmlContent: post.content.rendered,
  status: post.status,
  url: post.link,
  author: toAuthor(post._embedded?.author?.[0], post.author),
  publishedAt: post.date_gmt ?? post.date,
  modifiedAt: post.modified_gmt ?? post.modified,
  categoryIds: (post.categories ?? []).map(String),
  tagIds: (post.tags ?? []).map(String),
  featuredImage: toFeaturedImage(post._embedded?.["wp:featuredmedia"]?.[0]),
  seo: toSeoMetadata(post),
});

const toTerm = (
  term: WordPressApiTerm,
  taxonomy: WordPressTerm["taxonomy"],
): WordPressTerm => ({
  id: String(term.id),
  name: term.name,
  slug: term.slug,
  taxonomy,
});

const createRequest = (options: CreateWordPressProviderOptions) => {
  const baseUrl = normalizeBaseUrl(options.config.baseUrl);
  const authorizationHeader = buildAuthorizationHeader(options);
  const fetchImplementation = options.fetchImplementation ?? fetch;

  return async <T>(
    path: string,
    searchParams: Record<string, string | number | boolean | undefined>,
  ): Promise<{ data: T; response: Response }> => {
    const url = new URL(`${baseUrl}/wp-json/wp/v2/${path}`);

    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetchImplementation(url, {
          headers: {
            Accept: "application/json",
            ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
          },
          signal: AbortSignal.timeout(options.config.timeoutMs),
        });

        if (!response.ok) {
          if (
            RETRYABLE_STATUSES.has(response.status) &&
            attempt < DEFAULT_RETRY_ATTEMPTS
          ) {
            await sleep(getRetryDelay(attempt));
            continue;
          }

          throw new Error(
            `WordPress request failed with status ${response.status} for ${url.pathname}`,
          );
        }

        const data = (await response.json()) as T;
        return { data, response };
      } catch (error) {
        if (attempt >= DEFAULT_RETRY_ATTEMPTS) {
          throw error;
        }

        await sleep(getRetryDelay(attempt));
      }
    }

    throw new Error("WordPress request failed unexpectedly");
  };
};

const parsePagination = (response: Response, currentPage: number, itemCount: number) => {
  const totalPagesHeader = response.headers.get("x-wp-totalpages");
  const totalItemsHeader = response.headers.get("x-wp-total");

  return {
    page: currentPage,
    totalPages: totalPagesHeader ? Number(totalPagesHeader) : currentPage,
    totalItems: totalItemsHeader ? Number(totalItemsHeader) : itemCount,
  };
};

export const createWordPressProvider = (
  options: CreateWordPressProviderOptions,
): WordPressProvider => {
  const request = createRequest(options);
  const pageSize = Math.min(options.config.pageSize, MAX_WORDPRESS_PAGE_SIZE);

  const fetchTaxonomy = async (
    endpoint: "categories" | "tags",
    taxonomy: WordPressTerm["taxonomy"],
  ): Promise<WordPressTerm[]> => {
    const results: WordPressTerm[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const { data, response } = await request<WordPressApiTerm[]>(endpoint, {
        page,
        per_page: pageSize,
        hide_empty: "false",
        orderby: "id",
        order: "asc",
      });
      const pagination = parsePagination(response, page, data.length);
      totalPages = pagination.totalPages;
      results.push(...data.map((term) => toTerm(term, taxonomy)));
      page += 1;
    }

    return results;
  };

  return {
    fetchPosts: async (page: number): Promise<WordPressPostPage> => {
      const { data, response } = await request<WordPressApiPost[]>("posts", {
        page,
        per_page: pageSize,
        status: "publish",
        orderby: "date",
        order: "asc",
        _embed: 1,
      });
      const pagination = parsePagination(response, page, data.length);

      return {
        items: data.map(toPost),
        page: pagination.page,
        totalPages: pagination.totalPages,
        totalItems: pagination.totalItems,
      };
    },

    fetchAllPosts: async (): Promise<WordPressPost[]> => {
      const firstPage = await request<WordPressApiPost[]>("posts", {
        page: 1,
        per_page: pageSize,
        status: "publish",
        orderby: "date",
        order: "asc",
        _embed: 1,
      });
      const firstPagination = parsePagination(
        firstPage.response,
        1,
        firstPage.data.length,
      );
      const items = firstPage.data.map(toPost);

      for (let page = 2; page <= firstPagination.totalPages; page += 1) {
        const nextPage = await request<WordPressApiPost[]>("posts", {
          page,
          per_page: pageSize,
          status: "publish",
          orderby: "date",
          order: "asc",
          _embed: 1,
        });
        items.push(...nextPage.data.map(toPost));
      }

      return items;
    },

    fetchPost: async (id: string): Promise<WordPressPost> => {
      const { data } = await request<WordPressApiPost>(`posts/${id}`, {
        _embed: 1,
      });

      return toPost(data);
    },

    fetchCategories: async (): Promise<WordPressTerm[]> =>
      fetchTaxonomy("categories", "category"),

    fetchTags: async (): Promise<WordPressTerm[]> => fetchTaxonomy("tags", "tag"),
  };
};
