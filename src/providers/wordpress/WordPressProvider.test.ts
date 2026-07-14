import { describe, expect, it, vi } from "vitest";

import { createWordPressProvider } from "./WordPressProvider.js";

const createJsonResponse = (
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

describe("WordPressProvider", () => {
  it("fetches every page of published posts", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse(
          [
            {
              id: 1,
              date: "2024-01-01T00:00:00",
              modified: "2024-01-01T00:00:00",
              slug: "first",
              status: "publish",
              link: "https://example.com/first",
              title: { rendered: "First" },
              excerpt: { rendered: "<p>One</p>" },
              content: { rendered: "<p>One</p>" },
              categories: [],
              tags: [],
            },
          ],
          {
            headers: {
              "x-wp-totalpages": "2",
              "x-wp-total": "2",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse(
          [
            {
              id: 2,
              date: "2024-01-02T00:00:00",
              modified: "2024-01-02T00:00:00",
              slug: "second",
              status: "publish",
              link: "https://example.com/second",
              title: { rendered: "Second" },
              excerpt: { rendered: "<p>Two</p>" },
              content: { rendered: "<p>Two</p>" },
              categories: [],
              tags: [],
            },
          ],
          {
            headers: {
              "x-wp-totalpages": "2",
              "x-wp-total": "2",
            },
          },
        ),
      );

    const provider = createWordPressProvider({
      config: {
        baseUrl: "https://example.com",
        timeoutMs: 1000,
        pageSize: 10,
      },
      fetchImplementation: fetchMock,
    });

    const posts = await provider.fetchAllPosts();

    expect(posts).toHaveLength(2);
    expect(posts.map((post) => post.slug)).toEqual(["first", "second"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createJsonResponse({ message: "busy" }, { status: 503 }))
      .mockResolvedValueOnce(
        createJsonResponse([], {
          headers: {
            "x-wp-totalpages": "1",
            "x-wp-total": "0",
          },
        }),
      );

    const provider = createWordPressProvider({
      config: {
        baseUrl: "https://example.com",
        timeoutMs: 1000,
        pageSize: 10,
      },
      fetchImplementation: fetchMock,
    });

    const page = await provider.fetchPosts(1);

    expect(page.items).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
