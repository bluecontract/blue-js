import { ZodTypeAny } from 'zod';
import { JsonValue } from '@blue-labs/shared-utils';
import { BlueIdsRecord } from '../preprocess/utils/BlueIdsMappingGenerator';

export interface BlueRepository {
  blueIds: BlueIdsRecord;
  schemas: ZodTypeAny[];
  contents?: Record<string, JsonValue>;
}
