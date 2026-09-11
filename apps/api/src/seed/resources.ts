import type { Resource } from '@aifs/shared';
import { EN_RESOURCES } from './resources-en.js';
import { ZH_RESOURCES } from './resources-zh.js';

/**
 * 平台收录的全部免费学习资源。
 *
 * 中文与英文分开维护：两批资源的调研标准、核实方式和更新节奏不同，
 * 混在一个文件里既难 review 也容易冲突。
 *
 * 排序：先英文后中文。实际展示顺序由后端按「阶段 → 难度 → 时长」重排，
 * 这里只保证同一语言内的资源相邻，方便人工维护。
 */
export const RESOURCES: readonly Resource[] = [...EN_RESOURCES, ...ZH_RESOURCES];
