import { BlueMethod, BlueAgentClient, BlueMethodParam } from '../decorators';
import { BaseAgentClient } from './BaseAgentClient';

type Employee = {
  name: string;
  email: string;
};

type Primitive = string | number | boolean | null;

type ComparisonOperators<T> = {
  $eq?: T;
  $ne?: T;
  $gt?: T;
  $gte?: T;
  $lt?: T;
  $lte?: T;
  $in?: T[];
  $nin?: T[];
  $regex?: T extends string ? string : never;
  // Add more operators as needed
};

type FilterQuery<T> = T extends Primitive
  ? ComparisonOperators<T>
  : T extends Array<infer U>
  ? ComparisonOperators<U> | FilterQuery<U>
  : {
      [P in keyof T]?: FilterQuery<T[P]> | ComparisonOperators<T[P]>;
    };

@BlueAgentClient({ objectType: 'EmployeeCatalogue' })
export class EmployeeCatalogueAgentClient extends BaseAgentClient {
  @BlueMethod({ returnType: 'List' })
  list(
    @BlueMethodParam('FilterQuery') filter: FilterQuery<Employee>
  ): Promise<Employee[]> {
    throw new Error('Not implemented.');
  }

  @BlueMethod({ returnType: 'Employee' })
  create(
    @BlueMethodParam('Employee') employee: Omit<Employee, 'id'>
  ): Promise<Employee> {
    throw new Error('Not implemented.');
  }

  @BlueMethod({ returnType: 'Boolean' })
  delete(@BlueMethodParam('String') id: string): Promise<boolean> {
    throw new Error('Not implemented.');
  }

  // public static async getInstance({
  //   agentId,
  //   filter,
  // }: {
  //   agentId?: string;
  //   filter?: Record<string, unknown>;
  // } = {}) {
  //   const sdk = AppSDK.getInstance();
  //   if (agentId) {
  //     return new EmployeeCatalogueAgentClient(agentId);
  //   }

  //   const response = (await sdk.api.callAPI({
  //     type: 'initialize-agent',
  //     variables: {
  //       contract: {
  //         ...filter,
  //         methods: [
  //           {
  //             name: 'list',
  //             type: 'Method Definition',
  //             objectType: 'EmployeeCatalogue',
  //             returns: {
  //               type: 'List',
  //             },
  //           },
  //           {
  //             name: 'create',
  //             type: 'Method Definition',
  //             objectType: 'EmployeeCatalogue',
  //             params: {
  //               employee: {
  //                 type: 'Employee',
  //                 constraints: {
  //                   required: true,
  //                 },
  //               },
  //             },
  //             returns: {
  //               type: 'Employee',
  //             },
  //           },
  //           {
  //             name: 'delete',
  //             type: 'Method Definition',
  //             objectType: 'EmployeeCatalogue',
  //             params: {
  //               id: {
  //                 type: 'String',
  //                 constraints: {
  //                   required: true,
  //                 },
  //               },
  //             },
  //             returns: {
  //               type: 'Boolean',
  //             },
  //           },
  //         ],
  //       },
  //     },
  //   })) as { agentId: string };

  //   return new EmployeeCatalogueAgentClient(response.agentId);
  // }
}

// (async () => {
//   const employeeCatalogueService =
//     await EmployeeCatalogueAgentClient.getInstance({
//       contract: {
//         type: 'Timeline.blue Contract Agent',
//         contract: {
//           object: {
//             type: 'EmployeeCatalogue',
//             organization: {
//               name: 'ABC Ltd.',
//               email: 'info@abc.com',
//               address: {
//                 street: '123 Main St',
//               },
//             },
//           },
//         },
//       },
//     });

//   const items = await employeeCatalogueService.list({
//     name: {
//       $eq: 'John',
//     },
//   });

//   console.log(items);
// })();
