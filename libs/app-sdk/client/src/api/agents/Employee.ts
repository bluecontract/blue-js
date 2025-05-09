import { BlueMethod, BlueAgentClient, BlueMethodParam } from '../decorators';
import { BaseEmployeeAgentClient } from './BaseEmployeeAgentClient';

type Employee = {
  blueId: string;
  type: 'Employee';
  name: string;
  email: string;
};

@BlueAgentClient({ objectType: 'Employee' })
export class EmployeeAgentClient extends BaseEmployeeAgentClient {
  @BlueMethod({ returnType: 'Boolean' })
  setEmail(
    @BlueMethodParam('String') id: string,
    @BlueMethodParam('String') email: string
  ): Promise<boolean> {
    throw new Error('Not implemented.');
  }

  @BlueMethod({ returnType: 'Employee' })
  getEmployee(@BlueMethodParam('String') id: string): Promise<Employee> {
    throw new Error('Not implemented.');
  }
}
