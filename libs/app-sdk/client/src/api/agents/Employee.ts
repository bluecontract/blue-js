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

// (async () => {
//   const employee = {
//     blueId: '3jwV99sag7jpdHemZmGz9MFGzp8CtRVLb9CF2xAc8kt',
//     type: 'Employee',
//     name: 'John',
//     email: 'john@email.com',
//   } satisfies Employee;

//   const employeeAgent = await EmployeeAgentClient.getInstance({
//     filter: {
//       type: 'Timeline.blue Contract Agent',
//       contract: {
//         object: {
//           type: 'Employee',
//           blueId: '3jwV99sag7jpdHemZmGz9MFGzp8CtRVLb9CF2xAc8kt',
//         },
//       },
//     },
//   });

//   try {
//     const newEmployeeOptimistic = {
//       ...employee,
//       email: 'new@email.com',
//     };
//     await employeeAgent.setEmail(employee.blueId, 'new@email.com');
//   } catch (error) {
//     console.error(error);
//   }

//   const newEmployee = await employeeAgent.getEmployee(employee.blueId);

//   console.log(newEmployee);
// })();
