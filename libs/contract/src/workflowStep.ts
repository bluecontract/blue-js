import { isNonNullable } from '@blue-company/shared-utils';
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
