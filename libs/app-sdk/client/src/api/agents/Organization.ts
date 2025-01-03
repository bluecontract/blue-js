import { BlueMethod, BlueAgentClient, BlueMethodParam } from '../decorators';
import { BaseAgentClient } from './BaseAgentClient';

type Organization = {
  id: string;
  email: string;
};

@BlueAgentClient({ objectType: 'Organization' })
export class OrganizationAgentClient extends BaseAgentClient {
  @BlueMethod({ returnType: 'Boolean' })
  setEmail(@BlueMethodParam('String') email: string): Promise<boolean> {
    throw new Error('Not implemented.');
  }

  @BlueMethod({ returnType: 'Organization' })
  getLatestState(): Promise<Organization> {
    throw new Error('Not implemented.');
  }
}
