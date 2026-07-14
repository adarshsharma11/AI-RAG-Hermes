export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
}

export interface OllamaEmbeddingProviderOptions {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  fetchImplementation?: typeof fetch;
}

interface OllamaEmbedResponse {
  embeddings?: number[][];
  embedding?: number[];
}

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, "");

export const createOllamaEmbeddingProvider = ({
  baseUrl,
  model,
  timeoutMs,
  fetchImplementation = fetch,
}: OllamaEmbeddingProviderOptions): EmbeddingProvider => ({
  generateEmbedding: async (text) => {
    const response = await fetchImplementation(
      `${normalizeBaseUrl(baseUrl)}/api/embed`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model,
          input: text,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );

    if (!response.ok) {
      throw new Error(`Ollama embedding request failed with status ${response.status}`);
    }

    const data = (await response.json()) as OllamaEmbedResponse;
    const embedding = data.embeddings?.[0] ?? data.embedding;

    if (!embedding || embedding.length === 0) {
      throw new Error("Ollama embedding response did not include an embedding vector");
    }

    return embedding;
  },
});
