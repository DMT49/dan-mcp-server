/**
 * Tool: scrape_webpage
 * Fetches the plain text content of any public webpage URL.
 * Strips HTML tags and returns clean readable text.
 * Useful for reading articles, documentation, landing pages, etc.
 */
export const scrapeWebpageTool = {
  name: "scrape_webpage",
  description:
    "Fetch and read the content of any public webpage URL. Strips HTML and returns clean readable text. Use this to read articles, check a webpage's content, extract information from a URL, or research a specific page.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description:
          "The full URL of the webpage to scrape (must include https://).",
      },
      max_chars: {
        type: "number",
        description:
          "Maximum number of characters to return. Defaults to 5000. Increase for longer pages.",
      },
    },
    required: ["url"],
  },
  handler: async ({ url, max_chars }) => {
    const limit = max_chars || 5000;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; DanMCPBot/1.0; +https://dan-mcp-server.onrender.com)",
      },
    });

    if (!res.ok) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Failed to fetch URL. HTTP status: ${res.status}`,
              url,
            }),
          },
        ],
      };
    }

    const html = await res.text();

    // Strip HTML tags
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, limit);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              url,
              characters_returned: text.length,
              content: text,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
