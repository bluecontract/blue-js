import { EmployeeAgentClient } from '../agents/Employee';

describe('EmployeeAgentClient', () => {
  it('should set the email', async () => {
    const employee = await EmployeeAgentClient.getInstance();

    await employee.setEmail('123', 'abc@def.com');
    await employee.setName('123', 'John');
  });
});
