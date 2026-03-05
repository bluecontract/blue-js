import { yamlBlueDump } from '@blue-labs/language';
import type { BlueObject } from '../types.js';

export const toYaml = (value: BlueObject): string => yamlBlueDump(value);
