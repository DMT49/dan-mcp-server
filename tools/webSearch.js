/**
 * Tool: web_search
 * Searches the web using the DuckDuckGo Instant Answer API (free, no key needed).
 * For richer results, swap the fetch URL for a SerpAPI/Google Custom Search call.
 */
export const webSearchTool = {
  name: "web_search",
  description:
    "Search the web for information on any topic. Returns a summary and related topics from DuckDuckGo. Use this to find current information, facts, definitions, or anything that requires an internet search.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query or question to look up on the web.",
      },
    },
    required: ["query"],
  },
  handler: async ({ query }) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query
    )}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url);
    const data = await res.json();

    const result = {
      query,
      abstract: data.AbstractText || null,
      abstract_source: data.AbstractSource || null,
      abstract_url: data.AbstractURL || null,
      answer: data.Answer || null,
      answer_type: data.AnswerType || null,
      definition: data.Definition || null,
      related_topics: (data.RelatedTopics || [])
        .slice(0, 5)
        .map((t) => (typeof t.Text === "string" ? t.Text : null))
        .filter(Boolean),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};
