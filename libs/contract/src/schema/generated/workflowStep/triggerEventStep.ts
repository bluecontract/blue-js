import { BlueObject } from '@blue-company/language';
import { WorkflowStep } from './workflowStep';
import { ContractBlueIds } from '../blueIds';

export interface TriggerEventStep extends WorkflowStep {
  type?: BlueObject & {
    name?: 'Trigger Event Step';
    blueId?: ContractBlueIds['TriggerEventStep'];
  };
  event?: BlueObject;
}
