import { BlueRepository } from '@blue-labs/language';
import { blueIds } from './blue-ids';
import * as schemas from './schema';

export * from './schema';
export { blueIds } from './blue-ids';
export const allSchemas = Object.values(schemas);

export const repository: BlueRepository = {
  blueIds: blueIds,
  schemas: allSchemas,
};
