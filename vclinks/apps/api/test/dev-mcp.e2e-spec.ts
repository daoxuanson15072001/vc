import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { C, DbService } from '../src/db/db.service';
import { CLAIM_TTL_MS } from '../src/devreq/devreq.service';

describe('vclinks-dev MCP /mcp/dev (BA → design → code requests)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  let baseUrl: string;
  const tok = { desktop: '', code: '', mcp: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const parse = (r: unknown) => JSON.parse((r as { content: { text: string }[] }).content[0].text);
  const clients: Client[] = [];
  const connect = async (token: string) => {
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL('/mcp/dev', baseUrl), { requestInit: { headers: auth(token) } }));
    clients.push(client);
    return client;
  };
  const call = async (c: Client, name: string, args: Record<string, unknown> = {}) => {
    const r = await c.callTool({ name, arguments: args });
    return { ...parse(r), isError: r.isError === true };
  };

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_dev_mcp_test');
    app = await createApp({ logger: false });
    await app.listen(0);
    baseUrl = await app.getUrl();
    db = app.get(DbService);
    const tokens = app.get(TokenService);
    tok.desktop = await tokens.create('Claude Desktop', ['dev']);
    tok.code = await tokens.create('Claude Code', ['dev']);
    tok.mcp = await tokens.create('Claude ops', ['mcp']);
  });

  afterAll(async () => {
    for (const c of clients) await c.close();
    await app?.close();
    await mongo?.stop();
  });

  it('needs the dev scope, and the ops /mcp does not expose dev tools', async () => {
    await request(app.getHttpServer()).post('/mcp/dev').set(auth(tok.mcp)).send({}).expect(403);
    const desktop = await connect(tok.desktop);
    const names = (await desktop.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual(
      ['claim_request', 'get_request', 'get_system_spec', 'list_requests', 'read_ba', 'reply_request', 'review_request', 'submit_request', 'update_request'],
    );
    expect(desktop.getInstructions()).toMatch(/BA → thiết kế → code/);

    const ops = new Client({ name: 'e2e', version: '1.0.0' });
    await ops.connect(new StreamableHTTPClientTransport(new URL('/mcp', baseUrl), { requestInit: { headers: auth(tok.mcp) } }));
    clients.push(ops);
    expect((await ops.listTools()).tools.map((t) => t.name)).not.toContain('submit_request');
  });

  it('reads the BA and the system spec from the repo', async () => {
    const c = await connect(tok.desktop);
    const toc = await call(c, 'read_ba');
    expect(toc.files[0].file).toBe('docs/02-yeu-cau/vclinks-ba.md');
    expect(toc.files[0].headings.some((h: string) => /Quy tắc nghiệp vụ/.test(h))).toBe(true);

    const section = await call(c, 'read_ba', { file: 'vclinks-ba', section: 'quy tac nghiep vu' });
    expect(section.text).toMatch(/^## 7\. Quy tắc nghiệp vụ/);
    expect(section.text).not.toMatch(/## 8\./);

    const hits = await call(c, 'read_ba', { query: 'zalo oa' });
    expect(hits.hits.length).toBeGreaterThan(0);
    expect((await call(c, 'read_ba', { file: '../../etc/passwd' })).isError).toBe(true);

    const spec = await call(c, 'get_system_spec', { topic: 'overview' });
    expect(spec.files).toEqual(['CLAUDE.md']);
    expect(spec.text).toMatch(/VClinks/);
    const progress = await call(c, 'get_system_spec', { topic: 'progress' });
    expect(Array.isArray(progress.main)).toBe(true);
  });

  it('walks a request through BA → design → code with owner review between stages', async () => {
    const desktop = await connect(tok.desktop);
    const code = await connect(tok.code);

    const req = await call(desktop, 'submit_request', {
      title: 'Nút "Gửi báo giá" trong khung chat Zalo',
      description: 'Sale muốn gửi báo giá ngay trong khung chat, lấy giá từ VCsale.',
      acceptance: ['Có nút trên ô soạn', 'Chỉ đọc VCsale'],
      specRef: 'docs/02-yeu-cau/dac-ta/03-sale-zalo-ca-nhan.md MH-SZ-05',
      priority: 'high',
    });
    expect(req).toMatchObject({ stage: 'ba', status: 'new', stages: ['ba', 'design', 'code'], createdBy: 'Claude Desktop' });

    // A design worker finds nothing: the request is still at the BA stage.
    expect((await call(code, 'claim_request', { worker: 'designer', stage: 'design' })).request).toBeNull();

    const claimed = await call(code, 'claim_request', { worker: 'ba-wt', stage: 'ba' });
    expect(claimed.request).toMatchObject({ id: req.id, status: 'in_progress', claimedBy: 'Claude Code', claimedWorker: 'ba-wt' });
    // Same worker asking again gets the same request back.
    expect((await call(code, 'claim_request', { worker: 'ba-wt' })).request.id).toBe(req.id);

    // Only the holder can update; handing in needs a report.
    expect((await call(desktop, 'update_request', { requestId: req.id, note: 'x' })).isError).toBe(true);
    expect((await call(code, 'update_request', { requestId: req.id, status: 'review' })).isError).toBe(true);

    // Question round-trip.
    await call(code, 'update_request', { requestId: req.id, status: 'needs_info', note: 'Báo giá gửi dạng ảnh hay PDF?' });
    expect((await call(desktop, 'list_requests', { status: 'needs_info' })).total).toBe(1);
    await call(desktop, 'reply_request', { requestId: req.id, text: 'PDF' });
    const back = await call(code, 'claim_request', { worker: 'ba-wt', stage: 'ba' });
    expect(back.request).toMatchObject({ id: req.id, resumed: true });

    await call(code, 'update_request', {
      requestId: req.id,
      status: 'review',
      report: { summary: 'Thêm F3.9 và MH-SZ-05b', files: ['docs/02-yeu-cau/dac-ta/03-sale-zalo-ca-nhan.md'] },
    });
    // Nothing moves until the owner decides; revise sends the stage back.
    expect((await call(code, 'claim_request', { worker: 'designer', stage: 'design' })).request).toBeNull();
    expect((await call(desktop, 'review_request', { requestId: req.id, decision: 'revise' })).isError).toBe(true);
    expect(await call(desktop, 'review_request', { requestId: req.id, decision: 'revise', note: 'Thêm UAT' })).toMatchObject({ stage: 'ba', status: 'new' });
    await call(code, 'claim_request', { worker: 'ba-wt' });
    await call(code, 'update_request', { requestId: req.id, status: 'review', report: { summary: 'Thêm UAT-SZ-31' } });
    expect(await call(desktop, 'review_request', { requestId: req.id, decision: 'approve' })).toMatchObject({ stage: 'design', status: 'new' });

    await call(code, 'claim_request', { worker: 'designer', stage: 'design' });
    await call(code, 'update_request', {
      requestId: req.id,
      status: 'review',
      report: { summary: 'Mockup nút và hộp thoại', links: ['https://claude.ai/artifact/abc'] },
    });
    await call(desktop, 'review_request', { requestId: req.id, decision: 'approve' });

    const dev = await call(code, 'claim_request', { worker: 'quote-wt', stage: 'code' });
    expect(dev.request.id).toBe(req.id);
    await call(code, 'update_request', {
      requestId: req.id,
      status: 'review',
      branch: 'feat/quote-button',
      commits: ['abc1234'],
      report: { summary: 'Xong, có e2e', tests: 'pnpm test ok' },
    });
    expect(await call(desktop, 'review_request', { requestId: req.id, decision: 'approve' })).toMatchObject({ status: 'done' });

    const full = await call(desktop, 'get_request', { requestId: req.id });
    expect(Object.keys(full.reports).sort()).toEqual(['ba', 'code', 'design']);
    expect(full).toMatchObject({ branch: 'feat/quote-button', commits: ['abc1234'] });
    expect(full.log.map((e: { kind: string }) => e.kind)).toEqual(expect.arrayContaining(['question', 'answer', 'review', 'report']));
    expect(await db.col(C.auditLog).countDocuments({ action: 'devreq.review', target: req.id })).toBe(4);
  });

  it('runs only the chosen stages, returns stale claims to the queue, and lets the owner cancel', async () => {
    const desktop = await connect(tok.desktop);
    const code = await connect(tok.code);
    const bug = await call(desktop, 'submit_request', { title: 'Sửa lỗi ghim', description: 'Ghim hội thoại không lưu sau khi tải lại.', stages: ['code'] });
    expect(bug).toMatchObject({ stage: 'code', stages: ['code'] });

    await call(code, 'claim_request', { worker: 'w1', stage: 'code' });
    await db.col(C.devRequests).updateOne({ _id: new ObjectId(bug.id) }, { $set: { claimedAt: new Date(Date.now() - CLAIM_TTL_MS - 1000) } });
    const listed = await call(desktop, 'list_requests', {});
    expect(listed.items.find((i: { id: string }) => i.id === bug.id)).toMatchObject({ status: 'new', resumed: true, claimedBy: null });

    await call(desktop, 'reply_request', { requestId: bug.id, cancel: true });
    expect((await call(desktop, 'get_request', { requestId: bug.id })).status).toBe('cancelled');
    expect((await call(desktop, 'reply_request', { requestId: bug.id, cancel: true })).isError).toBe(true);
  });
});
