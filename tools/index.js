/**
 * Tool Registry
 * Add new tools here by importing and including them in the array.
 * Each tool needs: name, description, inputSchema, handler
 */
import { getCurrentDatetimeTool } from "./datetime.js";
import { webSearchTool } from "./webSearch.js";
import { scrapeWebpageTool } from "./scrapeWebpage.js";
import { fetchJsonTool } from "./fetchJson.js";

export const ALL_TOOLS = [
  getCurrentDatetimeTool,
  webSearchTool,
  scrapeWebpageTool,
  fetchJsonTool,
];
