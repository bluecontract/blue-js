import { getBlueObjectItems } from '@blue-company/language';
import { Contract, Workflow } from './schema';
import { isNonNullable } from '@blue-company/shared-utils';

export const getWorkflowByName = ({
  contract,
  workflowName,
}: {
  contract?: Contract | null;
  workflowName?: string;
}) => {
  return getBlueObjectItems(contract?.workflows)?.find(
    (workflow) => workflow.name === workflowName
  );
};

export const getUIWorkflowName = (workflow?: Workflow, index?: number) => {
  return (
    workflow?.name ??
    `Untitled Workflow${isNonNullable(index) ? ` #${index}` : ''}`
  );
};

export const getUIWorkflowTriggerName = (workflow?: Workflow) => {
  return workflow?.trigger?.name ?? 'Untitled Workflow Trigger';
};
