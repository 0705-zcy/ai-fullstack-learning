import type { DashboardSummary, ProgressStatus, Resource } from '@aifs/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiRequestError, type ResourceQuery } from '../api/client.js';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * 极简的数据获取 hook。
 *
 * MVP 阶段刻意不引入 react-query：需求只有「加载 + 重试 + 手动刷新」，
 * 自己写 30 行比多一个依赖更容易讲清楚。
 */
export function useAsync<T>(loader: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // 用 ref 存 loader，避免把函数身份写进依赖数组导致无限循环
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loaderRef
      .current()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof ApiRequestError ? cause.message : '加载失败，请稍后重试');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload };
}

export function useDashboard(): AsyncState<DashboardSummary> {
  return useAsync(() => api.getDashboard(), []);
}

/**
 * 进度写入。
 *
 * 采用乐观更新：先把界面改掉再发请求，失败时回滚并给出提示——
 * 勾选「已完成」这种操作如果还要等一个往返，体验会很迟钝。
 */
export function useProgressMutation(onChanged?: () => void) {
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const setStatus = useCallback(
    async (resourceId: string, status: ProgressStatus) => {
      setPending((prev) => new Set(prev).add(resourceId));
      setError(null);
      try {
        await api.setProgress(resourceId, status);
        onChanged?.();
      } catch (cause) {
        setError(cause instanceof ApiRequestError ? cause.message : '保存进度失败');
        throw cause;
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(resourceId);
          return next;
        });
      }
    },
    [onChanged],
  );

  const clear = useCallback(
    async (resourceId: string) => {
      setPending((prev) => new Set(prev).add(resourceId));
      setError(null);
      try {
        await api.clearProgress(resourceId);
        onChanged?.();
      } catch (cause) {
        setError(cause instanceof ApiRequestError ? cause.message : '清除进度失败');
        throw cause;
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(resourceId);
          return next;
        });
      }
    },
    [onChanged],
  );

  return { setStatus, clear, pending, error };
}

/** 当前用户的进度映射，供资源卡片快速查询状态。 */
export interface ProgressMapState {
  map: Map<string, ProgressStatus>;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** 本地先改（乐观更新），随后由请求结果或 reload 校正。 */
  setLocal: (resourceId: string, status: ProgressStatus) => void;
  clearLocal: (resourceId: string) => void;
}

export function useProgressMap(): ProgressMapState {
  const [map, setMap] = useState<Map<string, ProgressStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .listProgress()
      .then((result) => {
        if (cancelled) return;
        setMap(new Map(result.entries.map((entry) => [entry.resourceId, entry.status])));
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof ApiRequestError ? cause.message : '加载进度失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const setLocal = useCallback((resourceId: string, status: ProgressStatus) => {
    setMap((prev) => {
      const next = new Map(prev);
      next.set(resourceId, status);
      return next;
    });
  }, []);

  const clearLocal = useCallback((resourceId: string) => {
    setMap((prev) => {
      const next = new Map(prev);
      next.delete(resourceId);
      return next;
    });
  }, []);

  return { map, loading, error, reload, setLocal, clearLocal };
}

/** 资源库筛选状态。 */
export function useResourceFilters(initial: ResourceQuery = {}) {
  const [filters, setFilters] = useState<ResourceQuery>(initial);

  const update = useCallback(<K extends keyof ResourceQuery>(key: K, value: ResourceQuery[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setFilters(initial), [initial]);

  const activeCount = Object.entries(filters).filter(
    ([key, value]) => key !== 'sort' && value !== '' && value !== undefined,
  ).length;

  return { filters, update, reset, activeCount };
}

/** 用于把「资源 id → Resource」的查找逻辑收在一处。 */
export function indexById(resources: readonly Resource[]): Map<string, Resource> {
  return new Map(resources.map((resource) => [resource.id, resource]));
}
