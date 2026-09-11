import { describe, expect, it } from 'vitest';
import {
  checkRegistration,
  parseAllowedEmails,
  resolveRegistrationMode,
} from './registration.js';

describe('checkRegistration', () => {
  it('open 模式：任何邮箱都能注册', () => {
    const decision = checkRegistration({
      mode: 'open',
      allowedEmails: [],
      email: 'anyone@example.com',
      existingUserCount: 5,
    });

    expect(decision.allowed).toBe(true);
  });

  it('closed 模式：已有账号时拒绝新注册', () => {
    const decision = checkRegistration({
      mode: 'closed',
      allowedEmails: [],
      email: 'stranger@example.com',
      existingUserCount: 1,
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toContain('关闭注册');
    }
  });

  it('whitelist 模式：名单内放行、名单外拒绝', () => {
    const base = {
      mode: 'whitelist' as const,
      allowedEmails: ['me@example.com'],
      existingUserCount: 3,
    };

    expect(checkRegistration({ ...base, email: 'me@example.com' }).allowed).toBe(true);
    expect(checkRegistration({ ...base, email: 'other@example.com' }).allowed).toBe(false);
  });

  it('白名单比对不区分大小写、忽略首尾空格', () => {
    const decision = checkRegistration({
      mode: 'whitelist',
      allowedEmails: ['me@example.com'],
      email: '  ME@Example.COM  ',
      existingUserCount: 2,
    });

    expect(decision.allowed).toBe(true);
  });

  describe('引导例外：库里一个账号都没有时永远放行', () => {
    it('closed 模式下的首次部署仍能创建第一个账号', () => {
      const decision = checkRegistration({
        mode: 'closed',
        allowedEmails: [],
        email: 'first@example.com',
        existingUserCount: 0,
      });

      expect(decision.allowed).toBe(true);
      // 标记出来，好让服务端日志提示「这是引导例外」
      if (decision.allowed) expect(decision.bootstrapped).toBe(true);
    });

    it('whitelist 模式下同样放行（否则新部署直接锁死）', () => {
      const decision = checkRegistration({
        mode: 'whitelist',
        allowedEmails: ['someone-else@example.com'],
        email: 'first@example.com',
        existingUserCount: 0,
      });

      expect(decision.allowed).toBe(true);
    });

    it('open 模式下不算引导例外', () => {
      const decision = checkRegistration({
        mode: 'open',
        allowedEmails: [],
        email: 'first@example.com',
        existingUserCount: 0,
      });

      expect(decision.allowed).toBe(true);
      if (decision.allowed) expect(decision.bootstrapped).toBe(false);
    });

    it('一旦有了第一个账号，closed 立刻生效', () => {
      const decision = checkRegistration({
        mode: 'closed',
        allowedEmails: [],
        email: 'second@example.com',
        existingUserCount: 1,
      });

      expect(decision.allowed).toBe(false);
    });
  });
});

describe('parseAllowedEmails', () => {
  it('空值返回空数组', () => {
    expect(parseAllowedEmails(undefined)).toEqual([]);
    expect(parseAllowedEmails('')).toEqual([]);
    expect(parseAllowedEmails('   ')).toEqual([]);
  });

  it('按逗号切分、转小写、去空白', () => {
    expect(parseAllowedEmails(' Me@Example.com , You@Example.com ')).toEqual([
      'me@example.com',
      'you@example.com',
    ]);
  });

  it('去重', () => {
    expect(parseAllowedEmails('a@b.com,A@B.com,a@b.com')).toEqual(['a@b.com']);
  });

  it('容忍手滑的尾随逗号与连续逗号', () => {
    expect(parseAllowedEmails('a@b.com,,c@d.com,')).toEqual(['a@b.com', 'c@d.com']);
  });
});

describe('resolveRegistrationMode', () => {
  it('默认 open', () => {
    expect(resolveRegistrationMode(undefined, [])).toBe('open');
    expect(resolveRegistrationMode('', [])).toBe('open');
    expect(resolveRegistrationMode('open', [])).toBe('open');
  });

  it('识别 closed（大小写与空格都容忍）', () => {
    expect(resolveRegistrationMode('closed', [])).toBe('closed');
    expect(resolveRegistrationMode('  CLOSED  ', [])).toBe('closed');
  });

  it('白名单非空时强制 whitelist，压过 AIFS_REGISTRATION', () => {
    expect(resolveRegistrationMode(undefined, ['a@b.com'])).toBe('whitelist');
    expect(resolveRegistrationMode('open', ['a@b.com'])).toBe('whitelist');
    expect(resolveRegistrationMode('closed', ['a@b.com'])).toBe('whitelist');
  });

  it('取值写错时抛错，而不是静默地开在全网', () => {
    expect(() => resolveRegistrationMode('close', [])).toThrow(/AIFS_REGISTRATION/);
    expect(() => resolveRegistrationMode('false', [])).toThrow(/AIFS_REGISTRATION/);
    expect(() => resolveRegistrationMode('0', [])).toThrow(/AIFS_REGISTRATION/);
  });
});
