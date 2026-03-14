import { createOrderedObject } from '../../internal/order.js';
import type { BlueContract } from '../../types.js';

export const createChangeOperationContract = (
  type: string,
  channel: string,
  description: string,
): BlueContract =>
  createOrderedObject([
    ['type', type],
    ['channel', channel],
    ['description', description],
    [
      'request',
      {
        type: 'Conversation/Change Request',
      },
    ],
  ]);

export const createChangeWorkflowContract = (
  type: string,
  operation: string,
  postfix?: string,
): BlueContract =>
  createOrderedObject([
    ['type', type],
    ['operation', operation],
    ['postfix', postfix],
  ]);

export const createContractsPolicyContract = (
  requireSectionChanges: boolean,
): BlueContract =>
  createOrderedObject([
    ['type', 'Conversation/Contracts Change Policy'],
    ['requireSectionChanges', requireSectionChanges],
  ]);
