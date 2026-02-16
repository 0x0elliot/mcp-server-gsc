#!/usr/bin/env node

/**
 * Google Search Console MCP Server
 *
 * Supports two modes:
 * - stdio: Original mode for local CLI usage (default)
 * - http: HTTP server mode for multi-user deployments (Cloud Run, etc.)
 *
 * HTTP mode extracts OAuth tokens from the Authorization header, enabling
 * per-user credentials in a multi-tenant environment.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
// @ts-ignore
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  GetSitemapSchema,
  IndexInspectSchema,
  ListSitemapsSchema,
  SearchAnalyticsSchema,
  EnhancedSearchAnalyticsSchema,
  QuickWinsDetectionSchema,
  SubmitSitemapSchema,
} from './schemas.js';
import { z } from 'zod';
import { SearchConsoleService } from './search-console.js';

// Tool definitions for reuse
const TOOLS = [
  {
    name: 'list_sites',
    description: 'List all sites in Google Search Console',
    inputSchema: zodToJsonSchema(z.object({})),
  },
  {
    name: 'search_analytics',
    description: 'Get search performance data from Google Search Console',
    inputSchema: zodToJsonSchema(SearchAnalyticsSchema),
  },
  {
    name: 'enhanced_search_analytics',
    description: 'Enhanced search analytics with up to 25,000 rows, regex filters, and quick wins detection',
    inputSchema: zodToJsonSchema(EnhancedSearchAnalyticsSchema),
  },
  {
    name: 'detect_quick_wins',
    description: 'Automatically detect SEO quick wins and optimization opportunities',
    inputSchema: zodToJsonSchema(QuickWinsDetectionSchema),
  },
  {
    name: 'index_inspect',
    description: 'Inspect a URL to see if it is indexed or can be indexed',
    inputSchema: zodToJsonSchema(IndexInspectSchema),
  },
  {
    name: 'list_sitemaps',
    description: 'List sitemaps for a site in Google Search Console',
    inputSchema: zodToJsonSchema(ListSitemapsSchema),
  },
  {
    name: 'get_sitemap',
    description: 'Get a sitemap for a site in Google Search Console',
    inputSchema: zodToJsonSchema(GetSitemapSchema),
  },
  {
    name: 'submit_sitemap',
    description: 'Submit a sitemap for a site in Google Search Console',
    inputSchema: zodToJsonSchema(SubmitSitemapSchema),
  },
];

/**
 * Execute a tool with the given SearchConsoleService
 */
async function executeTool(
  toolName: string,
  args: Record<string, any>,
  searchConsole: SearchConsoleService
): Promise<any> {
  switch (toolName) {
    case 'enhanced_search_analytics': {
      const validatedArgs = EnhancedSearchAnalyticsSchema.parse(args);
      const siteUrl = validatedArgs.siteUrl;

      const requestBody: any = {
        startDate: validatedArgs.startDate,
        endDate: validatedArgs.endDate,
        dimensions: validatedArgs.dimensions,
        searchType: validatedArgs.type,
        aggregationType: validatedArgs.aggregationType,
        rowLimit: validatedArgs.rowLimit,
      };

      const filters = [];
      if (validatedArgs.pageFilter) {
        filters.push({
          dimension: 'page',
          operator: validatedArgs.filterOperator,
          expression: validatedArgs.pageFilter,
        });
      }
      if (validatedArgs.queryFilter) {
        filters.push({
          dimension: 'query',
          operator: validatedArgs.filterOperator,
          expression: validatedArgs.queryFilter,
        });
      }
      if (validatedArgs.countryFilter) {
        filters.push({
          dimension: 'country',
          operator: 'equals',
          expression: validatedArgs.countryFilter,
        });
      }
      if (validatedArgs.deviceFilter) {
        filters.push({
          dimension: 'device',
          operator: 'equals',
          expression: validatedArgs.deviceFilter,
        });
      }

      if (filters.length > 0) {
        requestBody.dimensionFilterGroups = [{ groupType: 'and', filters }];
      }

      const enhancedOptions = {
        regexFilter: validatedArgs.regexFilter,
        enableQuickWins: validatedArgs.enableQuickWins,
        quickWinsThresholds: validatedArgs.quickWinsThresholds,
      };

      const response = await searchConsole.enhancedSearchAnalytics(siteUrl, requestBody, enhancedOptions);
      return response.data;
    }

    case 'detect_quick_wins': {
      const validatedArgs = QuickWinsDetectionSchema.parse(args);

      const requestBody: any = {
        startDate: validatedArgs.startDate,
        endDate: validatedArgs.endDate,
        dimensions: ['query', 'page'],
        rowLimit: 25000,
      };

      const searchResponse = await searchConsole.searchAnalytics(validatedArgs.siteUrl, requestBody);

      if (!searchResponse.data.rows) {
        return { message: 'No data available for quick wins analysis' };
      }

      const quickWinsOptions = {
        enableQuickWins: true,
        quickWinsThresholds: {
          minImpressions: validatedArgs.minImpressions,
          maxCtr: validatedArgs.maxCtr,
          positionRangeMin: validatedArgs.positionRangeMin,
          positionRangeMax: validatedArgs.positionRangeMax,
        },
      };

      const enhancedResult = await searchConsole.enhancedSearchAnalytics(
        validatedArgs.siteUrl,
        requestBody,
        quickWinsOptions
      );

      return {
        quickWins: (enhancedResult.data as any).quickWins,
        totalOpportunities: (enhancedResult.data as any).quickWins?.length || 0,
        thresholds: quickWinsOptions.quickWinsThresholds,
        analysis: 'Quick wins detection completed'
      };
    }

    case 'search_analytics': {
      const validatedArgs = SearchAnalyticsSchema.parse(args);
      const siteUrl = validatedArgs.siteUrl;

      const requestBody: any = {
        startDate: validatedArgs.startDate,
        endDate: validatedArgs.endDate,
        dimensions: validatedArgs.dimensions,
        searchType: validatedArgs.type,
        aggregationType: validatedArgs.aggregationType,
        rowLimit: validatedArgs.rowLimit,
      };

      const filters = [];
      if (validatedArgs.pageFilter) {
        filters.push({
          dimension: 'page',
          operator: validatedArgs.filterOperator,
          expression: validatedArgs.pageFilter,
        });
      }
      if (validatedArgs.queryFilter) {
        filters.push({
          dimension: 'query',
          operator: validatedArgs.filterOperator,
          expression: validatedArgs.queryFilter,
        });
      }
      if (validatedArgs.countryFilter) {
        filters.push({
          dimension: 'country',
          operator: 'equals',
          expression: validatedArgs.countryFilter,
        });
      }
      if (validatedArgs.deviceFilter) {
        filters.push({
          dimension: 'device',
          operator: 'equals',
          expression: validatedArgs.deviceFilter,
        });
      }

      if (filters.length > 0) {
        requestBody.dimensionFilterGroups = [{ filters }];
      }

      const response = await searchConsole.searchAnalytics(siteUrl, requestBody);
      return response.data;
    }

    case 'list_sites': {
      const response = await searchConsole.listSites();
      return response.data;
    }

    case 'index_inspect': {
      const validatedArgs = IndexInspectSchema.parse(args);
      const requestBody = {
        siteUrl: validatedArgs.siteUrl,
        inspectionUrl: validatedArgs.inspectionUrl,
        languageCode: validatedArgs.languageCode,
      };
      const response = await searchConsole.indexInspect(requestBody);
      return response.data;
    }

    case 'list_sitemaps': {
      const validatedArgs = ListSitemapsSchema.parse(args);
      const requestBody = {
        siteUrl: validatedArgs.siteUrl,
        sitemapIndex: validatedArgs.sitemapIndex,
      };
      const response = await searchConsole.listSitemaps(requestBody);
      return response.data;
    }

    case 'get_sitemap': {
      const validatedArgs = GetSitemapSchema.parse(args);
      const requestBody = {
        siteUrl: validatedArgs.siteUrl,
        feedpath: validatedArgs.feedpath,
      };
      const response = await searchConsole.getSitemap(requestBody);
      return response.data;
    }

    case 'submit_sitemap': {
      const validatedArgs = SubmitSitemapSchema.parse(args);
      const requestBody = {
        siteUrl: validatedArgs.siteUrl,
        feedpath: validatedArgs.feedpath,
      };
      const response = await searchConsole.submitSitemap(requestBody);
      return response.data;
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Run server in STDIO mode (original behavior)
 */
async function runStdioServer() {
  const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS environment variable is required for stdio mode');
    process.exit(1);
  }

  const server = new Server(
    {
      name: 'gsc-mcp-server',
      version: '0.3.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      if (!request.params.arguments) {
        throw new Error('Arguments are required');
      }

      const searchConsole = new SearchConsoleService(GOOGLE_APPLICATION_CREDENTIALS, false);
      const result = await executeTool(request.params.name, request.params.arguments, searchConsole);

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      console.error(error);
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid arguments: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        );
      }
      throw error;
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Google Search Console MCP Server running on stdio');
}

/**
 * Run server in HTTP mode for multi-user deployments
 */
async function runHttpServer() {
  // Dynamic imports for HTTP dependencies
  const express = (await import('express')).default;
  const cors = (await import('cors')).default;

  const port = parseInt(process.env.PORT || '8080', 10);
  const host = process.env.HOST || '0.0.0.0';

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // MCP endpoint
  app.post('/mcp', async (req, res) => {
    // Extract access token from Authorization header
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: "Missing or invalid Authorization header. Use 'Bearer <token>'"
      });
    }

    const accessToken = authHeader.slice(7); // Remove "Bearer " prefix

    try {
      const { method, params } = req.body;

      if (method === 'tools/list') {
        return res.json({ tools: TOOLS });
      }

      if (method === 'tools/call') {
        const toolName = params?.name;
        const args = params?.arguments || {};

        if (!toolName) {
          return res.status(400).json({ error: 'Missing tool name' });
        }

        // Create service with access token
        const searchConsole = new SearchConsoleService(accessToken, true);
        const result = await executeTool(toolName, args, searchConsole);

        return res.json({
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        });
      }

      if (method === 'initialize') {
        return res.json({
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'gsc-mcp-server',
            version: '0.3.0'
          },
          capabilities: {
            tools: {}
          }
        });
      }

      return res.status(400).json({ error: `Unknown method: ${method}` });
    } catch (error) {
      console.error('Error handling MCP request:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: `Invalid arguments: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        });
      }

      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.listen(port, host, () => {
    console.log(`GSC MCP Server running in HTTP mode on http://${host}:${port}`);
    console.log(`Health check: http://${host}:${port}/health`);
    console.log(`MCP endpoint: http://${host}:${port}/mcp`);
  });
}

/**
 * Main entry point - select mode based on environment
 */
async function main() {
  const mode = (process.env.MCP_SERVER_MODE || 'stdio').toLowerCase();

  if (mode === 'http') {
    await runHttpServer();
  } else {
    await runStdioServer();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
