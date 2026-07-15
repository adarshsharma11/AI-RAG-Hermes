export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
}

const DEBUG_ENV_PATH = ".dbg/embedding-pipeline-stuck.env";

const reportEmbeddingProviderDebug = async (
  location: string,
  msg: string,
  data: Record<string, unknown>,
): Promise<void> => {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return;
  }

  // #region debug-point B:embedding-provider-report
  let debugServerUrl = "http://127.0.0.1:7777/event";
  let sessionId = "embedding-pipeline-stuck";
  let debugEnabled = false;

  try {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(DEBUG_ENV_PATH, "utf8");
    debugServerUrl =
      content.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() ?? debugServerUrl;
    sessionId = content.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() ?? sessionId;
    debugEnabled = true;
  } catch {}

  if (!debugEnabled) {
    return;
  }

  try {
    await fetch(debugServerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        runId: "pre-fix",
        hypothesisId: "B",
        location,
        msg: `[DEBUG] ${msg}`,
        data,
        ts: Date.now(),
      }),
    });
  } catch {}
  // #endregion
};

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
    await reportEmbeddingProviderDebug(
      "EmbeddingProvider.ts:request",
      "PROVIDER REQUEST START",
      {
        baseUrl: normalizeBaseUrl(baseUrl),
        model,
        timeoutMs,
        textLength: text.length,
      },
    );
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
    await reportEmbeddingProviderDebug(
      "EmbeddingProvider.ts:response",
      "PROVIDER RESPONSE RECEIVED",
      {
        ok: response.ok,
        status: response.status,
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

    await reportEmbeddingProviderDebug(
      "EmbeddingProvider.ts:parsed",
      "PROVIDER VECTOR PARSED",
      {
        vectorSize: embedding.length,
      },
    );

    return embedding;
  },
});
