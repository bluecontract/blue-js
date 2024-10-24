import { BaseBlueObject, BlueObject } from '@blue-company/language';
import { WorkflowStep } from './workflowStep';
import { JsonPatchEntry } from '../jsonPatch/jsonPatchEntry';
import { ContractBlueIds } from '../blueIds';

interface UpdateStepChangeset extends BaseBlueObject {
  items?: JsonPatchEntry[];
}

export interface UpdateStep extends WorkflowStep {
  type?: BlueObject & {
    name?: 'Update Step';
    blueId?: ContractBlueIds['UpdateStep'];
  };
  changeset?: UpdateStepChangeset;
}
