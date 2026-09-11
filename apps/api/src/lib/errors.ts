import type { Context } from 'hono';
import type { ApiError } from '@aifs/shared';

/** 带 HTTP 状态码的业务错误。 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }

  static badRequest(message: string, details?: unknown): HttpError {
    return new HttpError(400, 'bad_request', message, details);
  }
  static unauthorized(message = '请先登录'): HttpError {
    return new HttpError(401, 'unauthorized', message);
  }
  static forbidden(message = '没有权限'): HttpError {
    return new HttpError(403, 'forbidden', message);
  }
  static notFound(message = '资源不存在'): HttpError {
    return new HttpError(404, 'not_found', message);
  }
  static conflict(message: string): HttpError {
    return new HttpError(409, 'conflict', message);
  }
}

/** 统一错误响应体。 */
export function apiErrorBody(code: string, message: string, details?: unknown): ApiError {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

/** 把任意异常转成统一 JSON 响应。 */
export function toErrorResponse(c: Context, error: unknown): Response {
  if (error instanceof HttpError) {
    return c.json(apiErrorBody(error.code, error.message, error.details), error.status as 400);
  }

  const message = error instanceof Error ? error.message : String(error);
  // 未预期的错误：记录到服务端日志，但不要把内部细节泄露给客户端。
  console.error('[api] 未处理异常:', error);
  return c.json(apiErrorBody('internal_error', '服务器内部错误'), 500, {
    'X-Error-Detail': encodeURIComponent(message).slice(0, 200),
  });
}
