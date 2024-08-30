import { getBlueObjectItems } from '@blue-company/language';
import { Contract } from './schema';

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
