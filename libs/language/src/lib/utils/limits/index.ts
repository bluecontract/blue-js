export * from './Limits';
export * from './PathLimits';
export * from './NoLimits';
export * from './CompositeLimits';

import { Limits } from './Limits';
import { NoLimits } from './NoLimits';

/**
 * No limits implementation - extends all paths
 */
export const NO_LIMITS: Limits = new NoLimits();
