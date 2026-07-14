export interface WordPressApiRenderedField {
  rendered: string;
}

export interface WordPressApiAuthor {
  id: number;
  name: string;
  slug: string;
  link?: string;
}

export interface WordPressApiFeaturedMedia {
  id: number;
  source_url?: string;
  alt_text?: string;
  caption?: WordPressApiRenderedField;
}

export interface WordPressApiTerm {
  id: number;
  name: string;
  slug: string;
  taxonomy?: string;
}

export interface WordPressApiPost {
  id: number;
  date: string;
  date_gmt?: string;
  modified: string;
  modified_gmt?: string;
  slug: string;
  status: string;
  link: string;
  title: WordPressApiRenderedField;
  excerpt: WordPressApiRenderedField;
  content: WordPressApiRenderedField;
  author?: number;
  categories?: number[];
  tags?: number[];
  yoast_head_json?: Record<string, unknown>;
  rank_math_head?: string;
  aioseo_meta_data?: Record<string, unknown>;
  _embedded?: {
    author?: WordPressApiAuthor[];
    "wp:featuredmedia"?: WordPressApiFeaturedMedia[];
    "wp:term"?: WordPressApiTerm[][];
  };
}

export interface WordPressTerm {
  id: string;
  name: string;
  slug: string;
  taxonomy: "category" | "tag";
}

export interface WordPressAuthor {
  id: string;
  name: string | null;
  slug: string | null;
  url: string | null;
}

export interface WordPressFeaturedImage {
  id: string;
  url: string | null;
  altText: string | null;
  captionHtml: string | null;
}

export interface WordPressPost {
  id: string;
  slug: string;
  titleHtml: string;
  excerptHtml: string;
  htmlContent: string;
  status: string;
  url: string;
  author: WordPressAuthor | null;
  publishedAt: string;
  modifiedAt: string;
  categoryIds: string[];
  tagIds: string[];
  featuredImage: WordPressFeaturedImage | null;
  seo: Record<string, unknown> | null;
}

export interface WordPressPostPage {
  items: WordPressPost[];
  page: number;
  totalPages: number;
  totalItems: number;
}

export interface WordPressProviderConfig {
  baseUrl: string;
  timeoutMs: number;
  pageSize: number;
  bearerToken?: string;
  username?: string;
  applicationPassword?: string;
}

export interface CreateWordPressProviderOptions {
  config: WordPressProviderConfig;
  fetchImplementation?: typeof fetch;
}

export interface WordPressProvider {
  fetchPosts(page: number): Promise<WordPressPostPage>;
  fetchAllPosts(): Promise<WordPressPost[]>;
  fetchPost(id: string): Promise<WordPressPost>;
  fetchCategories(): Promise<WordPressTerm[]>;
  fetchTags(): Promise<WordPressTerm[]>;
}
