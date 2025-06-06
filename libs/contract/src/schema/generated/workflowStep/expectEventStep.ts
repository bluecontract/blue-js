import { BlueObject } from '@blue-labs/language';
import { WorkflowStep } from './workflowStep';
import { ContractBlueIds } from '../blueIds';

export interface ExpectEventStep extends WorkflowStep {
  type?: BlueObject & {
    name?: 'Expect Event Step';
    blueId?: ContractBlueIds['ExpectEventStep'];
  };
  event?: BlueObject;
}
