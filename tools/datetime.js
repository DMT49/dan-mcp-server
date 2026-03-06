/**
 * Tool: get_current_datetime
 * Returns the current date and time in a human-readable format.
 * Useful for agents that need to know today's date or current time.
 */
export const getCurrentDatetimeTool = {
  name: "get_current_datetime",
  description:
    "Get the current date and time. Use this when you need to know today's date, the current time, or want to timestamp something. Returns the current datetime in ISO format and a human-readable format.",
  inputSchema: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description:
          "Optional IANA timezone name (e.g. 'Europe/London', 'America/New_York'). Defaults to UTC.",
      },
    },
    required: [],
  },
  handler: async ({ timezone }) => {
    const tz = timezone || "UTC";
    const now = new Date();
    const formatted = now.toLocaleString("en-GB", {
      timeZone: tz,
      dateStyle: "full",
      timeStyle: "long",
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              iso: now.toISOString(),
              human_readable: formatted,
              timezone: tz,
              unix_timestamp: Math.floor(now.getTime() / 1000),
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
