import { Task } from '../types';

/**
 * Creates a task key for prioritization in the queue
 *
 * @param depth - Node depth in document (negated for priority)
 * @param eventSeq - Event sequence number for causal ordering
 * @param contractTypePriority - Priority based on contract type
 * @param contractOrder - Priority specified on the contract
 * @param contractName - Contract name for deterministic sorting
 * @param taskId - Sequence number for preserving insertion order
 * @returns Task key tuple for sorting
 */
export const makeTaskKey = (
  depth: number,
  eventSeq: number,
  contractTypePriority: number,
  contractOrder: number,
  contractName: string,
  taskId: number,
): Task['key'] => [
  -depth,
  eventSeq,
  contractTypePriority,
  contractOrder,
  contractName,
  taskId,
];

/**
 * Compares two tasks for sorting
 *
 * @param a - First task
 * @param b - Second task
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export const compareTasks = (a: Task, b: Task): number => {
  for (let i = 0; i < a.key.length; i++) {
    const av = a.key[i];
    const bv = b.key[i];
    if (av === bv) continue;

    if (typeof av === 'number' && typeof bv === 'number') {
      return av - bv;
    }
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv);
    }
    return 0;
  }
  return 0;
};
