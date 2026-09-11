import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY_LABEL,
  FORMAT_LABEL,
  LANGUAGE_LABEL,
  SCOPE_HINT,
  SCOPE_LABEL,
  STATUS_LABEL,
  accentOf,
  formatDateTime,
  formatHours,
  hostnameOf,
  toPercent,
} from './format.js';

describe('formatHours', () => {
  it('把小时渲染成中文', () => {
    expect(formatHours(3)).toBe('3 小时');
    expect(formatHours(1.5)).toBe('1.5 小时');
    expect(formatHours(12)).toBe('12 小时');
  });

  it('不足一小时时改用分钟', () => {
    expect(formatHours(0.5)).toBe('30 分钟');
    expect(formatHours(0.25)).toBe('15 分钟');
  });

  it('非法输入不崩，给出兜底文案', () => {
    expect(formatHours(0)).toBe('时长未知');
    expect(formatHours(-1)).toBe('时长未知');
    expect(formatHours(Number.NaN)).toBe('时长未知');
    expect(formatHours(Number.POSITIVE_INFINITY)).toBe('时长未知');
  });
});

describe('toPercent', () => {
  it('把 0–1 的比率转成整数百分比', () => {
    expect(toPercent(0)).toBe(0);
    expect(toPercent(0.5)).toBe(50);
    expect(toPercent(1)).toBe(100);
    expect(toPercent(2 / 3)).toBe(67);
  });

  it('越界值被夹住，避免进度条撑破布局', () => {
    expect(toPercent(1.5)).toBe(100);
    expect(toPercent(-0.5)).toBe(0);
    expect(toPercent(Number.NaN)).toBe(0);
  });
});

describe('hostnameOf', () => {
  it('取出域名并去掉 www 前缀', () => {
    expect(hostnameOf('https://www.freecodecamp.org/learn/x')).toBe('freecodecamp.org');
    expect(hostnameOf('https://react.dev/learn')).toBe('react.dev');
  });

  it('非法 URL 原样返回而不是抛错', () => {
    expect(hostnameOf('not a url')).toBe('not a url');
    expect(hostnameOf('')).toBe('');
  });
});

describe('accentOf', () => {
  it('已知 accent 返回对应配色', () => {
    expect(accentOf('sky').dot).toBe('bg-sky-500');
    expect(accentOf('emerald').dot).toBe('bg-emerald-500');
  });

  it('未知或缺失的 accent 退回中性色', () => {
    expect(accentOf('chartreuse').dot).toBe('bg-slate-500');
    expect(accentOf(undefined).dot).toBe('bg-slate-500');
    expect(accentOf('').dot).toBe('bg-slate-500');
  });

  it('每个阶段的配色类名都是完整的 Tailwind 类（保证能被扫描到）', () => {
    for (const accent of ['sky', 'violet', 'emerald', 'amber', 'rose', 'indigo']) {
      const classes = accentOf(accent);
      for (const value of Object.values(classes)) {
        expect(value).toMatch(/^(bg|text|border|ring)-/);
        expect(value).not.toContain('$');
      }
    }
  });
});

describe('formatDateTime', () => {
  it('输出本地时间短格式', () => {
    // 用本地时间构造，避免测试受时区影响
    const iso = new Date(2024, 4, 1, 10, 5).toISOString();
    expect(formatDateTime(iso)).toBe('2024-05-01 10:05');
  });

  it('非法输入原样返回', () => {
    expect(formatDateTime('whatever')).toBe('whatever');
  });
});

describe('标签字典', () => {
  it('覆盖所有枚举值（漏了会显示 undefined）', () => {
    expect(Object.keys(LANGUAGE_LABEL).sort()).toEqual(['en', 'zh']);
    expect(Object.keys(DIFFICULTY_LABEL).sort()).toEqual(['advanced', 'beginner', 'intermediate']);
    expect(Object.keys(FORMAT_LABEL).sort()).toEqual(['course', 'docs', 'interactive', 'video']);
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(['completed', 'learning', 'wishlist']);
    expect(Object.keys(SCOPE_LABEL).sort()).toEqual(['curriculum', 'supplement']);
    expect(Object.keys(SCOPE_HINT).sort()).toEqual(['curriculum', 'supplement']);

    for (const dict of [
      LANGUAGE_LABEL,
      DIFFICULTY_LABEL,
      FORMAT_LABEL,
      STATUS_LABEL,
      SCOPE_LABEL,
      SCOPE_HINT,
    ]) {
      for (const label of Object.values(dict)) {
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });

  it('体系课的标签要能一眼看懂，不能只是「curriculum」', () => {
    expect(SCOPE_LABEL.curriculum).toContain('完整');
    expect(SCOPE_HINT.curriculum).toContain('项目');
  });
});
