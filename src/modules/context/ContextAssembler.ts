import {
  calculateKeywordCoverage,
  countExactKeywordMatches,
  getDocumentDeduplicationKey,
  getDocumentUrl,
} from "./ContextFilters.js";

const TARGET_CHUNK_WORDS = 650;
const CHUNK_OVERLAP_WORDS = 120;
const MIN_CONTEXT_SNIPPET_CHARS = 120;
const MAX_EXCERPT_CHARS = 240;

export interface ContextSourceDocument {
  id: string;
  title: string | null;
  url: string | null;
  score: number;
  excerpt: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface ContextChunkCandidate {
  id: string;
  title: string | null;
  url: string | null;
  score: number;
  excerpt: string;
  context: string;
  metadata: Record<string, unknown>;
  wordCount: number;
  keywordCoverage: number;
  exactKeywordMatches: number;
}

export interface AssembledContextDocument {
  id: string;
  title: string | null;
  url: string | null;
  score: number;
  excerpt: string;
  context: string;
  metadata: Record<string, unknown>;
}

export interface TrimmedContextResult {
  documents: AssembledContextDocument[];
  totalCharacters: number;
  trimmingRatio: number;
}

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const truncateText = (value: string, limit: number): string => {
  if (limit <= 0) {
    return "";
  }

  if (value.length <= limit) {
    return value;
  }

  const truncated = value.slice(0, Math.max(0, limit - 1)).trimEnd();
  return `${truncated}…`;
};

const countDocumentCharacters = (document: {
  title: string | null;
  excerpt: string;
  context: string;
}): number =>
  (document.title?.length ?? 0) + document.excerpt.length + document.context.length;

export const splitIntoChunks = (
  content: string,
  options: { targetWords?: number | undefined; overlapWords?: number | undefined } = {},
): string[] => {
  const targetWords = options.targetWords ?? TARGET_CHUNK_WORDS;
  const overlapWords = options.overlapWords ?? CHUNK_OVERLAP_WORDS;
  const words = normalizeWhitespace(content).split(" ").filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  if (words.length <= targetWords) {
    return [words.join(" ")];
  }

  const chunks: string[] = [];
  const step = Math.max(1, targetWords - overlapWords);

  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + targetWords);

    if (slice.length === 0) {
      break;
    }

    chunks.push(slice.join(" "));

    if (start + targetWords >= words.length) {
      break;
    }
  }

  return chunks;
};

export const deduplicateDocuments = (
  documents: readonly ContextSourceDocument[],
): ContextSourceDocument[] => {
  const deduplicated = new Map<string, ContextSourceDocument>();

  for (const document of documents) {
    const key = getDocumentDeduplicationKey({
      id: document.id,
      title: document.title,
      url: document.url ?? getDocumentUrl(document.metadata),
      metadata: document.metadata,
    });
    const existing = deduplicated.get(key);

    if (!existing || document.score > existing.score) {
      deduplicated.set(key, document);
    }
  }

  return [...deduplicated.values()];
};

export const buildChunkCandidates = (
  documents: readonly ContextSourceDocument[],
  keywords: readonly string[],
): ContextChunkCandidate[] =>
  documents.flatMap((document) => {
    const chunks = splitIntoChunks(document.content);
    const fallbackChunk =
      normalizeWhitespace(`${document.title ?? ""} ${document.excerpt}`).trim() ||
      document.excerpt ||
      document.title ||
      "";
    const sourceChunks = chunks.length > 0 ? chunks : [fallbackChunk];

    return sourceChunks
      .map((chunk): ContextChunkCandidate | null => {
        const normalizedChunk = normalizeWhitespace(chunk);

        if (!normalizedChunk) {
          return null;
        }

        return {
          id: document.id,
          title: document.title,
          url: document.url,
          score: document.score,
          excerpt: document.excerpt,
          context: normalizedChunk,
          metadata: document.metadata,
          wordCount: normalizedChunk.split(" ").filter(Boolean).length,
          keywordCoverage: calculateKeywordCoverage(
            `${document.title ?? ""} ${document.excerpt} ${normalizedChunk}`,
            keywords,
          ),
          exactKeywordMatches: countExactKeywordMatches(
            `${document.title ?? ""} ${normalizedChunk}`,
            keywords,
          ),
        };
      })
      .filter((candidate): candidate is ContextChunkCandidate => candidate !== null);
  });

export const selectBestChunkPerDocument = (
  candidates: readonly ContextChunkCandidate[],
): ContextChunkCandidate[] => {
  const bestCandidates = new Map<string, ContextChunkCandidate>();

  for (const candidate of candidates) {
    const existing = bestCandidates.get(candidate.id);

    if (
      !existing ||
      candidate.keywordCoverage > existing.keywordCoverage ||
      (candidate.keywordCoverage === existing.keywordCoverage &&
        candidate.exactKeywordMatches > existing.exactKeywordMatches) ||
      (candidate.keywordCoverage === existing.keywordCoverage &&
        candidate.exactKeywordMatches === existing.exactKeywordMatches &&
        candidate.score > existing.score)
    ) {
      bestCandidates.set(candidate.id, candidate);
    }
  }

  return [...bestCandidates.values()];
};

export const trimContextDocuments = (
  documents: readonly AssembledContextDocument[],
  input: { maxCharacters: number; maxChunks: number },
): TrimmedContextResult => {
  const finalDocuments: AssembledContextDocument[] = [];
  let totalCharacters = 0;
  const originalCharacters = documents.reduce(
    (total, document) => total + countDocumentCharacters(document),
    0,
  );

  for (const document of documents) {
    if (finalDocuments.length >= input.maxChunks) {
      break;
    }

    const remaining = input.maxCharacters - totalCharacters;

    if (remaining <= MIN_CONTEXT_SNIPPET_CHARS) {
      break;
    }

    const title = document.title ? truncateText(document.title, remaining) : null;
    let consumed = title?.length ?? 0;

    const preferredExcerpt = truncateText(document.excerpt, MAX_EXCERPT_CHARS);
    let excerptBudget = Math.min(preferredExcerpt.length, Math.max(0, remaining - consumed));
    let contextBudget = Math.max(0, remaining - consumed - excerptBudget);

    if (contextBudget < MIN_CONTEXT_SNIPPET_CHARS) {
      excerptBudget = Math.max(0, excerptBudget - (MIN_CONTEXT_SNIPPET_CHARS - contextBudget));
      contextBudget = Math.max(0, remaining - consumed - excerptBudget);
    }

    const excerpt = truncateText(preferredExcerpt, excerptBudget);
    consumed += excerpt.length;

    const context = truncateText(document.context, Math.max(0, remaining - consumed));

    if (context.length < MIN_CONTEXT_SNIPPET_CHARS) {
      continue;
    }

    const trimmedDocument = {
      ...document,
      title,
      excerpt,
      context,
    };

    const documentCharacters = countDocumentCharacters(trimmedDocument);
    finalDocuments.push(trimmedDocument);
    totalCharacters += documentCharacters;
  }

  return {
    documents: finalDocuments,
    totalCharacters,
    trimmingRatio:
      originalCharacters === 0 ? 1 : Math.min(1, totalCharacters / originalCharacters),
  };
};
