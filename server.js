/**
 * Dan's MCP Server
 * Supports both SSE (legacy) and StreamableHTTP transport.
 * Secured with a Bearer token.
 *
 * Endpoints:
 *   GET  /sse        → SSE transport (for clients like Relevance AI)
 *   POST /messages   → SSE message handler
 *   POST /mcp        → StreamableHTTP transport (newer clients)
 *   GET  /health     → Health check (no auth required)
 */

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { ALL_TOOLS } from "./tools/index.js";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "sk-dan-mcp-9Kx2pL7mQvRn4bE8";

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());

// CORS – allow all origins so Relevance AI can connect
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id"
  );
  res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", tools: ALL_TOOLS.map((t) => t.name) });
});

// Bearer token auth middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token || token !== API_KEY) {
    res
      .status(401)
      .json({ error: "Unauthorized. Provide a valid Bearer token." });
    return;
  }
  next();
}

// ─── MCP Server Factory ────────────────────────────────────────────────────────

function createMcpServer() {
  const server = new McpServer({
    name: "Dan's MCP Server",
    version: "1.0.0",
    instructions:
      "This MCP server provides utility tools for Dan's AI agents. Tools include web search, webpage scraping, JSON API calls, and date/time helpers. Use the tool descriptions to decide which tool is appropriate for the task.",
  });

  // Register all tools from the registry
  for (const tool of ALL_TOOLS) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.properties,
      tool.handler
    );
  }

  return server;
}

// ─── SSE Transport (Legacy – used by most hosted clients including Relevance AI) ──

const sseTransports = {};

app.get("/sse", requireAuth, async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  sseTransports[transport.sessionId] = transport;

  res.on("close", () => {
    delete sseTransports[transport.sessionId];
  });

  const server = createMcpServer();
  await server.connect(transport);
});

app.post("/messages", requireAuth, async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = sseTransports[sessionId];

  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await transport.handlePostMessage(req, res, req.body);
});

// ─── StreamableHTTP Transport (Newer clients) ─────────────────────────────────

const httpTransports = {};

app.post("/mcp", requireAuth, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

  let transport;
  if (sessionId && httpTransports[sessionId]) {
    transport = httpTransports[sessionId];
  } else if (isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () =>
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15),
      onsessioninitialized: (id) => {
        httpTransports[id] = transport;
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) delete httpTransports[transport.sessionId];
    };
    const server = createMcpServer();
    await server.connect(transport);
  } else {
    res
      .status(400)
      .json({ error: "Bad request: missing session ID or initialize request" });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", requireAuth, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const transport = httpTransports[sessionId];
  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await transport.handleRequest(req, res);
});

app.delete("/mcp", requireAuth, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const transport = httpTransports[sessionId];
  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await transport.handleRequest(req, res);
});

// ─── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ Dan's MCP Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   SSE:    http://localhost:${PORT}/sse`);
  console.log(`   HTTP:   http://localhost:${PORT}/mcp`);
  console.log(`   Tools:  ${ALL_TOOLS.map((t) => t.name).join(", ")}`);
});
