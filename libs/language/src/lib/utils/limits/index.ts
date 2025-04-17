export * from './Limits';
export * from './PathLimits';
export * from './NoLimits';

import { Limits } from './Limits';
import { NoLimits } from './NoLimits';

/**
 * No limits implementation - extends all paths
 */
export const NO_LIMITS: Limits = new NoLimits();
