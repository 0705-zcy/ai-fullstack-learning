import type { RegistrationMode } from '@aifs/shared';

/**
 * 注册准入判断。**纯函数**，不碰数据库。
 *
 * 为什么需要这个：这个项目会以「公开源码 + 个人自部署」的形态存在，
 * 而它没有邮箱验证、没有找回密码、也没有速率限制。
 * 一旦部署到公网又开着注册，任何知道地址的人都能建号。
 * 所以给个人自用留一个明确的开关，比默认全开再让人自己想办法要负责。
 */

export interface RegistrationPolicy {
  mode: RegistrationMode;
  /** 白名单邮箱（小写、已去重）。仅 mode === 'whitelist' 时有意义。 */
  allowedEmails: readonly string[];
}

export type RegistrationDecision =
  | { allowed: true; bootstrapped: boolean }
  | { allowed: false; reason: string };

export interface RegistrationCheckInput extends RegistrationPolicy {
  email: string;
  /** 库里已存在的用户数。 */
  existingUserCount: number;
}

/**
 * 判断某个邮箱能否注册。
 *
 * 有一条**引导例外**：库里一个用户都没有时无条件放行。
 * 没有这条例外，配上 `registration=closed` 的新部署会直接锁死——
 * 谁也进不来，而唯一的解法是手改数据库。宁可短暂开一个口子，
 * 也不要让用户陷入这种死局。
 */
export function checkRegistration(input: RegistrationCheckInput): RegistrationDecision {
  if (input.existingUserCount === 0) {
    // 关着注册但库是空的：这是首次部署，放行第一个账号
    return { allowed: true, bootstrapped: input.mode !== 'open' };
  }

  switch (input.mode) {
    case 'open':
      return { allowed: true, bootstrapped: false };

    case 'closed':
      return {
        allowed: false,
        reason: '这个实例已关闭注册，只能使用已有账号登录。',
      };

    case 'whitelist': {
      const email = input.email.trim().toLowerCase();
      return input.allowedEmails.includes(email)
        ? { allowed: true, bootstrapped: false }
        : {
            allowed: false,
            reason: '这个邮箱不在允许注册的名单里。',
          };
    }
  }
}

/**
 * 解析 `AIFS_ALLOWED_EMAILS`：逗号分隔，统一转小写并去重。
 * 顺手丢弃空项，这样 `a@b.com,` 这种手滑的写法不会造成困扰。
 */
export function parseAllowedEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0),
    ),
  ];
}

/**
 * 解析 `AIFS_REGISTRATION`。
 * 白名单非空时优先，避免「配了白名单却写着 open」这种自相矛盾的组合。
 */
export function resolveRegistrationMode(
  rawMode: string | undefined,
  allowedEmails: readonly string[],
): RegistrationMode {
  if (allowedEmails.length > 0) {
    if (rawMode && rawMode.trim().toLowerCase() !== 'whitelist') {
      // 不报错，但要让配置者知道哪个生效了
      console.warn(
        `[config] AIFS_ALLOWED_EMAILS 非空，注册策略按 whitelist 生效（忽略 AIFS_REGISTRATION=${rawMode}）`,
      );
    }
    return 'whitelist';
  }

  const mode = rawMode?.trim().toLowerCase();
  if (!mode || mode === 'open') return 'open';
  if (mode === 'closed') return 'closed';

  // 拼错就启动失败，好过静默地把注册开在全网
  throw new Error(
    `AIFS_REGISTRATION 取值非法：${rawMode}（可选 open / closed，或改用 AIFS_ALLOWED_EMAILS 指定白名单）`,
  );
}
