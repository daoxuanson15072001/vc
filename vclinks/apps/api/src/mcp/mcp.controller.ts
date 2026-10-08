import { All, Controller, Post, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Response } from 'express';
import { Scopes, type AuthedRequest } from '../auth/auth.guard';
import { McpToolsFactory } from './mcp.tools';

/**
 * Streamable HTTP MCP endpoint at `/mcp` (outside the `/api` prefix).
 * Stateless: a fresh server + transport per request, JSON responses.
 */
@Controller('mcp')
@Scopes('mcp')
export class McpController {
  constructor(private readonly tools: McpToolsFactory) {}

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

  /** No server-initiated streams or sessions in stateless mode. */
  @All()
  notAllowed(@Res() res: Response) {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed' },
      id: null,
    });
  }
}
