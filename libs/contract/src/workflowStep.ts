import { isNonNullable } from '@blue-labs/shared-utils';
import { WorkflowStep } from './schema';

export const getUIWorkflowStepName = (
  workflowStep?: WorkflowStep,
  index?: number
) => {
  return (
    workflowStep?.name ??
    `Untitled Workflow Step${isNonNullable(index) ? ` #${index}` : ''}`
  );
};
