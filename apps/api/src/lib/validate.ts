import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { HttpError } from './errors.js';

/** zod 校验失败时，把 issue 列表压成前端好渲染的格式。 */
function toDetails(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/** 解析并校验 JSON 请求体。校验失败抛 400，附带逐字段错误信息。 */
export async function parseJsonBody<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw HttpError.badRequest('请求体必须是合法的 JSON');
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw HttpError.badRequest('请求参数校验失败', toDetails(result.error));
  }
  return result.data;
}

/**
 * 解析并校验查询参数。
 *
 * 空字符串一律当作「没传」丢掉，这样前端可以放心地把表单值原样拼进 URL。
 */
export function parseQuery<T>(c: Context, schema: ZodType<T>): T {
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(c.req.query())) {
    if (typeof value === 'string' && value.trim() !== '') {
      raw[key] = value;
    }
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw HttpError.badRequest('查询参数不合法', toDetails(result.error));
  }
  return result.data;
}
