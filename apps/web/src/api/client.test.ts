import { describe, expect, it } from 'vitest';
import { ApiRequestError, toQueryString } from './client.js';

describe('toQueryString', () => {
  it('没有条件时返回空串', () => {
    expect(toQueryString({})).toBe('');
  });

  it('空值一律不拼进查询串', () => {
    expect(toQueryString({ stage: '', language: '', q: '', maxHours: '' })).toBe('');
    expect(toQueryString({ q: '   ' })).toBe('');
  });

  it('单条件正常拼接', () => {
    expect(toQueryString({ stage: 'rag' })).toBe('?stage=rag');
    expect(toQueryString({ language: 'zh' })).toBe('?language=zh');
  });

  it('多条件按固定顺序拼接', () => {
    const qs = toQueryString({ stage: 'rag', language: 'zh', difficulty: 'advanced' });
    expect(qs).toBe('?stage=rag&language=zh&difficulty=advanced');
  });

  it('关键词会去掉首尾空格并做 URL 编码', () => {
    expect(toQueryString({ q: '  prompt engineering  ' })).toBe('?q=prompt+engineering');
    expect(toQueryString({ q: 'C++ & RAG' })).toBe('?q=C%2B%2B+%26+RAG');
  });

  it('maxHours 只有正整数才生效', () => {
    expect(toQueryString({ maxHours: 10 })).toBe('?maxHours=10');
    expect(toQueryString({ maxHours: 0 })).toBe('');
    expect(toQueryString({ maxHours: '' })).toBe('');
  });

  it('默认排序不拼参数，其余排序生效', () => {
    expect(toQueryString({ sort: 'default' })).toBe('');
    expect(toQueryString({ sort: 'duration-asc' })).toBe('?sort=duration-asc');
  });
});

describe('ApiRequestError', () => {
  it('保留状态码与业务错误码', () => {
    const error = new ApiRequestError(409, 'conflict', '邮箱已注册', [{ field: 'email' }]);

    expect(error.status).toBe(409);
    expect(error.code).toBe('conflict');
    expect(error.message).toBe('邮箱已注册');
    expect(error.details).toEqual([{ field: 'email' }]);
    expect(error).toBeInstanceOf(Error);
  });

  it('isUnauthorized 只对 401 为真', () => {
    expect(new ApiRequestError(401, 'unauthorized', '请先登录').isUnauthorized).toBe(true);
    expect(new ApiRequestError(403, 'forbidden', '没有权限').isUnauthorized).toBe(false);
    expect(new ApiRequestError(0, 'network_error', '无法连接服务器').isUnauthorized).toBe(false);
  });
});
