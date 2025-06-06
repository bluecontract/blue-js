import { BlueObject, BlueObjectStringValue } from '@blue-labs/language';
import { WorkflowStep } from './workflowStep';
import { ContractBlueIds } from '../blueIds';

export interface JavaScriptCodeStep extends WorkflowStep {
  type?: BlueObject & {
    name?: 'JavaScript Code Step';
    blueId?: ContractBlueIds['JavaScriptCodeStep'];
  };
  code?: BlueObjectStringValue;
}
