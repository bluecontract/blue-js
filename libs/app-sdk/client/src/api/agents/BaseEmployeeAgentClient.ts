import { BlueAgentClient, BlueMethod, BlueMethodParam } from '../decorators';
import { BaseAgentClient } from './BaseAgentClient';

@BlueAgentClient({ objectType: 'Employee' })
export class BaseEmployeeAgentClient extends BaseAgentClient {
  @BlueMethod({ returnType: 'Boolean' })
  setName(
    @BlueMethodParam('String') id: string,
    @BlueMethodParam('String') name: string
  ): Promise<boolean> {
    throw new Error('Not implemented.');
  }
}
