import type { SearchService, SearchResultItem } from "../search/search.service.js";

export interface DuplicateMatch {
  id: string;
  title: string | null;
  url: string | null;
  score: number;
  excerpt: string;
}

export interface DuplicateDetectionResult {
  duplicate: boolean;
  duplicateScore: number;
  matchingArticle: DuplicateMatch | null;
  similarArticles: DuplicateMatch[];
}

const toDuplicateMatch = (item: SearchResultItem): DuplicateMatch => ({
  id: item.id,
  title: item.title,
  url: item.url,
  score: item.score,
  excerpt: item.excerpt,
});

export interface CreateDuplicateDetectorOptions {
  searchService: SearchService;
}

export interface DuplicateDetector {
  detect(input: {
    projectId: string;
    text: string;
  }): Promise<DuplicateDetectionResult>;
}

export const createDuplicateDetector = ({
  searchService,
}: CreateDuplicateDetectorOptions): DuplicateDetector => ({
  detect: async ({ projectId, text }) => {
    const response = await searchService.findSimilar({
      text,
      projectId,
      limit: 5,
    });
    const similarArticles = response.items.map(toDuplicateMatch);
    const matchingArticle = similarArticles[0] ?? null;

    return {
      duplicate: matchingArticle !== null,
      duplicateScore: matchingArticle?.score ?? 0,
      matchingArticle,
      similarArticles,
    };
  },
});
