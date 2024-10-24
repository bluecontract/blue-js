import { BlueObject, BlueObjectStringValue } from '@blue-company/language';
import { WorkflowStep } from './workflowStep';
import { ContractBlueIds } from '../blueIds';

export interface JavaScriptCodeStep extends WorkflowStep {
  type?: BlueObject & {
    name?: 'JavaScript Code Step';
    blueId?: ContractBlueIds['JavaScriptCodeStep'];
  };
  code?: BlueObjectStringValue;
}
