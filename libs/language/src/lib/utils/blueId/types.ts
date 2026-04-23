import { JsonBlueValue } from '../../../schema';

export type BlueIdHashValue = Exclude<JsonBlueValue, null | undefined>;
