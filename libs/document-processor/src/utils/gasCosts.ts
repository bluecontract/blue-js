/**
 * Centralised gas cost definitions for deterministic metering.
 *
 * These constants are intentionally small to keep the absolute budgets easy to
 * reason about while still providing enough granularity for tests.
 */
export const GAS_COST_ROUTE_TRAVERSAL = 5;
export const GAS_COST_ROUTE_MATCH = 10;
export const GAS_COST_HANDLER_INVOCATION = 25;
export const GAS_COST_PATCH_APPLICATION = 15;
export const GAS_COST_EMITTED_EVENT = 10;
