import { pick } from 'radash';
import { blueIds as mockBlueIds } from './blue-ids';
import {
  OperationSchema,
  OperationRequestSchema,
  SequentialWorkflowOperationSchema,
} from './schema';

export {
  type Operation,
  OperationSchema,
  type OperationRequest,
  OperationRequestSchema,
  type SequentialWorkflowOperation,
  SequentialWorkflowOperationSchema,
} from './schema';

export const allSchemas = {
  OperationSchema,
  OperationRequestSchema,
  SequentialWorkflowOperationSchema,
};
export const blueIds = pick(mockBlueIds, [
  'Channel Event Checkpoint',
  'Operation',
  'Operation Request',
  'Sequential Workflow Operation',
]);
