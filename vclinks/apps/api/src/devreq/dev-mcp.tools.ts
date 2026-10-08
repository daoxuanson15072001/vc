import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Principal } from '../auth/token.service';
import { run } from '../mcp/mcp.tools';
import { DevRequestsService, PRIORITIES, STAGES } from './devreq.service';
import { SPEC_TOPICS, SpecDocsService } from './spec-docs.service';

const INSTRUCTIONS = [
  'MCP phát triển của VClinks: biến yêu cầu của chủ dự án qua hội thoại thành thay đổi BA → thiết kế → code, từng chặng có người duyệt.',
  'Claude Desktop (nói chuyện với chủ dự án): trước khi gửi yêu cầu, gọi read_ba (ý đồ nghiệp vụ: docs/02-yeu-cau/ gồm BA tổng vclinks-ba.md và đặc tả dac-ta/) và get_system_spec (hiện trạng từ code) để không yêu cầu thứ đã có và để trỏ đúng mã màn hình (MH-…) / mục BA; báo cho chủ dự án chỗ yêu cầu lệch với BA hoặc hệ thống.',
  'Gửi bằng submit_request (mặc định đi đủ 3 chặng ba → design → code; sửa lỗi thuần code thì stages=["code"]). Theo dõi bằng list_requests / get_request.',
  'Khi một chặng ở trạng thái review: đọc report của chặng (file BA đã sửa, link mockup, commit), tóm tắt cho chủ dự án, rồi gọi review_request approve (sang chặng sau) hoặc revise (kèm việc cần sửa) theo đúng ý chủ dự án — không tự duyệt thay.',
  'Trạng thái needs_info = Claude Code đang hỏi: chuyển câu hỏi cho chủ dự án, trả lời bằng reply_request.',
  'Claude Code (làm việc trong repo): claim_request(stage?, worker = tên worktree) nhận một chặng; chặng ba sửa docs/02-yeu-cau/vclinks-ba.md hoặc docs/02-yeu-cau/dac-ta/*.md; chặng design làm mockup (canvas / artifact), không viết code; chặng code làm trên nhánh riêng trong VCzalo-worktrees/, có test. Báo tiến độ / hỏi lại / nộp chặng bằng update_request (status=review kèm report {summary, files, links, tests}).',
].join(' ');

/** Builds the per-request `vclinks-dev` MCP server (scope `dev`). */
@Injectable()
export class DevMcpToolsFactory {
  constructor(
    private readonly requests: DevRequestsService,
    private readonly docs: SpecDocsService,
  ) {}

  create(principal: Principal): McpServer {
    const server = new McpServer({ name: 'vclinks-dev', version: '0.1.0' }, { instructions: INSTRUCTIONS });
    const actor = principal.name;
    const via = 'mcp';
    const stage = z.enum(STAGES);

    server.registerTool(
      'read_ba',
      {
        description:
          'Đọc BA (ý đồ nghiệp vụ). Không tham số: mục lục các file BA (docs/02-yeu-cau/**, sổ quyết định, dữ liệu kiểm thử) kèm heading. file (đường dẫn hoặc đoạn tên, vd "03-sale"): nội dung file; thêm section (một phần heading, không phân biệt dấu, vd "MH-SZ-05" hoặc "Quy tắc nghiệp vụ") để lấy riêng mục đó. query: tìm dòng trong mọi file BA. Nội dung dài thì phân trang bằng offset (nextOffset).',
        inputSchema: {
          file: z.string().max(200).optional(),
          section: z.string().max(200).optional(),
          query: z.string().min(2).max(200).optional(),
          offset: z.number().int().min(0).default(0),
        },
      },
      ({ file, section, query, offset }) =>
        run(async () => (query && !file ? this.docs.searchBa(query) : this.docs.readBa({ file, section, offset }))),
    );

    server.registerTool(
      'get_system_spec',
      {
        description: `Hiện trạng hệ thống từ repo (điều code đang làm, khác với BA là điều muốn làm). Không tham số: danh sách chủ đề. topic: ${Object.keys(SPEC_TOPICS).join(', ')}, progress (commit gần nhất trên main và các nhánh đang làm). Phân trang bằng offset.`,
        inputSchema: {
          topic: z.enum([...(Object.keys(SPEC_TOPICS) as [keyof typeof SPEC_TOPICS]), 'progress']).optional(),
          offset: z.number().int().min(0).default(0),
        },
      },
      ({ topic, offset }) => run(() => this.docs.systemSpec(topic, offset)),
    );

    server.registerTool(
      'submit_request',
      {
        description:
          'Chủ dự án gửi yêu cầu thay đổi. Viết description đủ để người không dự hội thoại làm được: bối cảnh, việc cần đổi, ví dụ; acceptance = tiêu chí nghiệm thu, mỗi dòng một ý; specRef = mục BA / mã màn hình liên quan. stages mặc định ["ba","design","code"]; bỏ chặng không cần (vd chỉ sửa BA: ["ba"]; sửa lỗi code: ["code"]).',
        inputSchema: {
          title: z.string().min(3).max(200),
          description: z.string().min(10).max(20_000),
          acceptance: z.array(z.string().max(1000)).max(30).optional(),
          priority: z.enum(PRIORITIES).optional(),
          specRef: z.string().max(500).optional(),
          stages: z.array(stage).min(1).max(3).optional(),
        },
      },
      (args) => run(() => this.requests.submit(args, actor, via)),
    );

    server.registerTool(
      'list_requests',
      {
        description:
          'Danh sách yêu cầu, mới cập nhật trước. status: "open" (mặc định = new, in_progress, needs_info, review), "" = tất cả, hoặc danh sách cách dấu phẩy. review = một chặng làm xong, chờ chủ dự án duyệt; needs_info = đang chờ chủ dự án trả lời.',
        inputSchema: {
          status: z.string().max(200).default('open'),
          stage: stage.optional(),
          limit: z.number().int().min(1).max(100).default(20),
        },
      },
      (args) => run(() => this.requests.list(args)),
    );

    server.registerTool(
      'get_request',
      {
        description: 'Chi tiết một yêu cầu: mô tả, tiêu chí, chặng hiện tại, report từng chặng (file, link mockup, test), commit, nhật ký hỏi–đáp.',
        inputSchema: { requestId: z.string().length(24) },
      },
      ({ requestId }) => run(() => this.requests.get(requestId)),
    );

    server.registerTool(
      'review_request',
      {
        description:
          'Chủ dự án duyệt chặng đang ở trạng thái review. approve: sang chặng kế (hết chặng thì done). revise: trả chặng về hàng chờ, note ghi rõ cần sửa gì. Chỉ gọi theo quyết định của chủ dự án.',
        inputSchema: {
          requestId: z.string().length(24),
          decision: z.enum(['approve', 'revise']),
          note: z.string().max(10_000).default(''),
        },
      },
      ({ requestId, decision, note }) => run(() => this.requests.review(requestId, decision, note, actor, via)),
    );

    server.registerTool(
      'reply_request',
      {
        description: 'Chủ dự án trả lời câu hỏi (needs_info → về hàng chờ, được nhận trước), bổ sung ý, mở lại yêu cầu đã đóng, hoặc huỷ (cancel=true).',
        inputSchema: {
          requestId: z.string().length(24),
          text: z.string().max(10_000).default(''),
          cancel: z.boolean().default(false),
        },
      },
      ({ requestId, text, cancel }) => run(() => this.requests.reply(requestId, text, cancel, actor, via)),
    );

    server.registerTool(
      'claim_request',
      {
        description:
          'Claude Code nhận MỘT chặng để làm (stage để lọc; bỏ trống = chặng nào cũng được). worker = tên phiên / worktree, để nhiều phiên song song không giẫm nhau. Đang giữ yêu cầu chưa nộp thì trả lại chính nó. request=null: hàng chờ trống. Mỗi update_request gia hạn giữ việc; quá 3 giờ không cập nhật thì yêu cầu tự về hàng chờ.',
        inputSchema: { worker: z.string().min(1).max(100), stage: stage.optional() },
      },
      ({ worker, stage: s }) => run(() => this.requests.claim(actor, via, worker, s)),
    );

    server.registerTool(
      'update_request',
      {
        description:
          'Người đang giữ yêu cầu: ghi tiến độ (note), hỏi chủ dự án (status=needs_info, note = câu hỏi), nộp chặng (status=review, report = {summary, files[], links[] (mockup), tests, followups[]}), hoặc từ chối (status=rejected, report.summary = lý do). branch / commits ghi nhánh và commit của chặng code.',
        inputSchema: {
          requestId: z.string().length(24),
          status: z.enum(['in_progress', 'needs_info', 'review', 'rejected']).optional(),
          note: z.string().max(10_000).optional(),
          branch: z.string().max(200).optional(),
          commits: z.array(z.string().max(80)).max(50).optional(),
          report: z
            .object({
              summary: z.string().min(1).max(10_000),
              files: z.array(z.string().max(300)).max(100).optional(),
              links: z.array(z.string().url().max(500)).max(20).optional(),
              tests: z.string().max(5000).optional(),
              followups: z.array(z.string().max(1000)).max(30).optional(),
            })
            .optional(),
        },
      },
      ({ requestId, ...input }) => run(() => this.requests.update(requestId, input, actor, via)),
    );

    return server;
  }
}
