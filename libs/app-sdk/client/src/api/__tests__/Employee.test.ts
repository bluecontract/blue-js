import { EmployeeAgentClient } from '../agents/Employee';
import { AppSDK } from '../../sdk';
describe('EmployeeAgentClient', () => {
  it('should set the email', async () => {
    const sdk = AppSDK.getInstance();

    const employee = await sdk.askUserForAgent(
      {
        contract: {
          object: {
            type: 'Employee',
          },
        },
      },
      EmployeeAgentClient
    );

    await employee.setEmail('123', 'abc@def.com');
    await employee.setName('123', 'John');
  });
});
