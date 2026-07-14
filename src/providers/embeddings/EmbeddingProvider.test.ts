import { describe, expect, it, vi } from "vitest";

import { createOllamaEmbeddingProvider } from "./EmbeddingProvider.js";

describe("OllamaEmbeddingProvider", () => {
  it("calls the Ollama embed endpoint and returns the first embedding", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          embeddings: [[0.1, 0.2, 0.3]],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const provider = createOllamaEmbeddingProvider({
      baseUrl: "http://127.0.0.1:11434/",
      model: "nomic-embed-text",
      timeoutMs: 1000,
      fetchImplementation: fetchMock,
    });

    const embedding = await provider.generateEmbedding("Hello world");

    expect(embedding).toEqual([0.1, 0.2, 0.3]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/embed",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
