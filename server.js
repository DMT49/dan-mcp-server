/**
 * Dan's Relevance AI MCP Proxy Server
 *
 * Takes the @relevanceai/relevanceai-mcp-server (normally a local CLI command)
 * and wraps it in an HTTP/SSE layer so Relevance AI agents can connect via URL.
 *
 * Endpoints:
 *   GET  /sse      → SSE transport (what Relevance AI agent connects to)
 *   POST /messages → SSE message handler
 *   GET  /health   → Health check (no auth)
 */

import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "sk-dan-mcp-9Kx2pL7mQvRn4bE8";

// Relevance AI config — set these as env vars on Render
const RELEVANCE_AUTH_TOKEN = process.env.RELEVANCE_AUTH_TOKEN;
const RELEVANCE_REGION = process.env.RELEVANCE_REGION || "bcbe5a";
const RELEVANCE_TOOLS = process.env.RELEVANCE_TOOLS;

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());

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

// Health check — no auth required
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Dan's Relevance AI MCP Proxy",
    region: RELEVANCE_REGION,
    auth_token_set: !!RELEVANCE_AUTH_TOKEN,
    tools_filter: RELEVANCE_TOOLS ? "yes" : "none",
  });
});

// Bearer token auth
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

// ─── Relevance AI Client Factory ──────────────────────────────────────────────
// Creates a fresh subprocess + MCP client for each incoming SSE connection.

async function createRelevanceClient() {
  if (!RELEVANCE_AUTH_TOKEN) {
    throw new Error("RELEVANCE_AUTH_TOKEN env var is not set.");
  }

  // Build args for the locally installed binary (faster than npx)
  const binaryArgs = ["--region", RELEVANCE_REGION];
  if (RELEVANCE_TOOLS) {
    binaryArgs.push("--tools", RELEVANCE_TOOLS);
  }

  const transport = new StdioClientTransport({
    command: "./node_modules/.bin/relevanceai-mcp-server",
    args: binaryArgs,
    env: {
      ...process.env,
      RELEVANCE_AUTH_TOKEN,
    },
  });

  const client = new Client(
    { name: "relevance-ai-proxy", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("✅ Relevance AI MCP client connected");
  return client;
}

// ─── SSE Transport ────────────────────────────────────────────────────────────

const sseTransports = {};

app.get("/sse", requireAuth, async (req, res) => {
  console.log("→ New SSE connection");

  let relevanceClient;

  try {
    relevanceClient = await createRelevanceClient();
  } catch (err) {
    console.error("Failed to connect to Relevance AI:", err.message);
    res
      .status(500)
      .json({ error: "Failed to connect to Relevance AI MCP server." });
    return;
  }

  // Build a proxy MCP server that forwards everything to the Relevance AI client
  const proxyServer = new Server(
    { name: "Dan's Relevance AI Proxy", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Forward tools/list
  proxyServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = await relevanceClient.listTools();
    console.log(`↕ tools/list → ${result.tools?.length ?? 0} tools`);
    return result;
  });

  // Forward tools/call
  proxyServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.log(`↕ tools/call → ${request.params.name}`);
    const result = await relevanceClient.callTool(request.params);
    return result;
  });

  // Connect to SSE transport
  const transport = new SSEServerTransport("/messages", res);
  sseTransports[transport.sessionId] = transport;

  res.on("close", async () => {
    console.log(`← SSE connection closed (${transport.sessionId})`);
    delete sseTransports[transport.sessionId];
    try {
      await relevanceClient.close();
    } catch (_) {}
  });

  try {
    await proxyServer.connect(transport);
  } catch (err) {
    console.error("SSE server error:", err.message);
  }
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

// ─── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✅ Dan's Relevance AI MCP Proxy running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   SSE:    http://localhost:${PORT}/sse`);
  console.log(`   Region: ${RELEVANCE_REGION}`);
  console.log(`   Auth token set: ${!!RELEVANCE_AUTH_TOKEN}\n`);
});
