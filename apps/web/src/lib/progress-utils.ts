import type { ProgressStatus } from '@aifs/shared';

/** 资源状态的下一个状态：点一下就轮转，减少操作成本。 */
export function nextStatus(current: ProgressStatus | undefined): ProgressStatus {
  switch (current) {
    case undefined:
      return 'wishlist';
    case 'wishlist':
      return 'learning';
    case 'learning':
      return 'completed';
    case 'completed':
      return 'wishlist';
  }
}

/** 资源的搜索匹配：标题、提供方、说明、主题都能命中。 */
export function matchesKeyword(
  resource: { title: string; provider: string; description: string; topics: string[] },
  keyword: string,
): boolean {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return true;

  return (
    resource.title.toLowerCase().includes(needle) ||
    resource.provider.toLowerCase().includes(needle) ||
    resource.description.toLowerCase().includes(needle) ||
    resource.topics.some((topic) => topic.toLowerCase().includes(needle))
  );
}

/** 从资源列表里统计各状态的数量，用于仪表盘和阶段页的小结。 */
export function countByStatus(
  resourceIds: readonly string[],
  progress: ReadonlyMap<string, ProgressStatus>,
): Record<ProgressStatus | 'none', number> {
  const counts = { none: 0, wishlist: 0, learning: 0, completed: 0 };
  for (const id of resourceIds) {
    const status = progress.get(id);
    if (status) counts[status] += 1;
    else counts.none += 1;
  }
  return counts;
}

/** 阶段是否可见（未解锁时前端也要能展示「还差多少」）。 */
export function stageLockReason(
  stage: { unlocked: boolean; completed: boolean },
  previousStageTitle?: string,
): string | null {
  if (stage.unlocked) return null;
  return previousStageTitle
    ? `完成「${previousStageTitle}」后解锁（完成度 80% 即可提前解锁）`
    : '完成前一阶段后解锁';
}
