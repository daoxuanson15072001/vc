import { All, Controller, Post, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Response } from 'express';
import { Scopes, type AuthedRequest } from '../auth/auth.guard';
import { DevMcpToolsFactory } from './dev-mcp.tools';

/**
 * `vclinks-dev` MCP at `/mcp/dev`: the change-request channel (BA → design →
 * code) between Claude Desktop and Claude Code. Separate from `/mcp` so
 * operational tokens (scope `mcp`) never see it and dev tokens never ingest.
 * Stateless, like `/mcp`.
 */
@Controller('mcp/dev')
@Scopes('dev')
export class DevMcpController {
  constructor(private readonly tools: DevMcpToolsFactory) {}

  @Post()
  async handle(@Req() req: AuthedRequest, @Res() res: Response) {
    const server = this.tools.create(req.principal);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  @All()
  notAllowed(@Res() res: Response) {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed' },
      id: null,
    });
  }
}
