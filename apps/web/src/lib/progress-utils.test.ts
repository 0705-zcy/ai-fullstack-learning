import type { ProgressStatus } from '@aifs/shared';
import { describe, expect, it } from 'vitest';
import { countByStatus, matchesKeyword, nextStatus, stageLockReason } from './progress-utils.js';

describe('nextStatus', () => {
  it('按 未标记 → 想学 → 在学 → 已完成 → 想学 轮转', () => {
    expect(nextStatus(undefined)).toBe('wishlist');
    expect(nextStatus('wishlist')).toBe('learning');
    expect(nextStatus('learning')).toBe('completed');
    expect(nextStatus('completed')).toBe('wishlist');
  });

  it('轮转一圈后回到起点，不会出现 undefined', () => {
    let status: ProgressStatus | undefined;
    for (let i = 0; i < 4; i += 1) {
      status = nextStatus(status);
      expect(status).toBeTruthy();
    }
    expect(status).toBe('wishlist');
  });
});

describe('matchesKeyword', () => {
  const resource = {
    title: 'Deep Learning Specialization',
    provider: 'DeepLearning.AI',
    description: '系统学习神经网络与 RAG 基础',
    topics: ['rag', 'prompt-engineering'],
  };

  it('空关键词匹配一切', () => {
    expect(matchesKeyword(resource, '')).toBe(true);
    expect(matchesKeyword(resource, '   ')).toBe(true);
  });

  it('命中标题、提供方、说明与主题', () => {
    expect(matchesKeyword(resource, 'specialization')).toBe(true);
    expect(matchesKeyword(resource, 'deeplearning.ai')).toBe(true);
    expect(matchesKeyword(resource, '神经网络')).toBe(true);
    expect(matchesKeyword(resource, 'prompt-engineering')).toBe(true);
  });

  it('大小写不敏感', () => {
    expect(matchesKeyword(resource, 'RAG')).toBe(true);
    expect(matchesKeyword(resource, 'rag')).toBe(true);
  });

  it('完全不相关时返回 false', () => {
    expect(matchesKeyword(resource, 'kubernetes')).toBe(false);
  });
});

describe('countByStatus', () => {
  it('统计四种情况：未标记、想学、在学、已完成', () => {
    const progress = new Map<string, ProgressStatus>([
      ['a', 'completed'],
      ['b', 'learning'],
      ['c', 'wishlist'],
    ]);

    expect(countByStatus(['a', 'b', 'c', 'd'], progress)).toEqual({
      none: 1,
      wishlist: 1,
      learning: 1,
      completed: 1,
    });
  });

  it('空列表返回全零', () => {
    expect(countByStatus([], new Map())).toEqual({
      none: 0,
      wishlist: 0,
      learning: 0,
      completed: 0,
    });
  });

  it('进度里有多余的记录不会影响统计（以传入的资源 id 为准）', () => {
    const progress = new Map<string, ProgressStatus>([['ghost', 'completed']]);
    expect(countByStatus(['a'], progress)).toEqual({
      none: 1,
      wishlist: 0,
      learning: 0,
      completed: 0,
    });
  });
});

describe('stageLockReason', () => {
  it('已解锁时没有锁提示', () => {
    expect(stageLockReason({ unlocked: true, completed: false }, '编程基础')).toBeNull();
  });

  it('未解锁时提示需要完成哪个阶段', () => {
    expect(stageLockReason({ unlocked: false, completed: false }, '编程基础')).toContain('编程基础');
    expect(stageLockReason({ unlocked: false, completed: false }, '编程基础')).toContain('80%');
  });

  it('没有前置阶段信息时给出通用提示', () => {
    expect(stageLockReason({ unlocked: false, completed: false })).toContain('前一阶段');
  });
});
