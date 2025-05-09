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
}
