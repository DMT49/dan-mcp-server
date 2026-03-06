/**
 * Tool: fetch_json_api
 * Makes a GET or POST request to any JSON API endpoint and returns the response.
 * Useful for agents that need to call external APIs dynamically.
 */
export const fetchJsonTool = {
  name: "fetch_json_api",
  description:
    "Make a GET or POST request to any JSON API endpoint and return the response. Use this when you need to call an external API, retrieve data from a REST endpoint, or interact with web services. Supports custom headers and a JSON request body for POST requests.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full API endpoint URL to call.",
      },
      method: {
        type: "string",
        enum: ["GET", "POST", "PUT", "PATCH"],
        description: "HTTP method. Defaults to GET.",
      },
      headers: {
        type: "object",
        description:
          "Optional headers as key-value pairs (e.g. { 'Authorization': 'Bearer TOKEN' }).",
      },
      body: {
        type: "object",
        description: "Optional JSON body for POST/PUT/PATCH requests.",
      },
    },
    required: ["url"],
  },
  handler: async ({ url, method, headers, body }) => {
    const requestMethod = method || "GET";
    const requestHeaders = {
      "Content-Type": "application/json",
      ...(headers || {}),
    };

    const options = {
      method: requestMethod,
      headers: requestHeaders,
    };

    if (body && ["POST", "PUT", "PATCH"].includes(requestMethod)) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    const responseText = await res.text();

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              url,
              method: requestMethod,
              status: res.status,
              ok: res.ok,
              response: responseData,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
