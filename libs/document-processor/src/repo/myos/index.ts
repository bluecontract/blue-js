import { BlueRepository } from '@blue-labs/language';
import * as schemas from './schema';
import { blueIds } from './blue-ids';

export * from './schema';
export { blueIds } from './blue-ids';
export const allSchemas = Object.values(schemas);

export const repository: BlueRepository = {
  blueIds: blueIds,
  schemas: allSchemas,
};
