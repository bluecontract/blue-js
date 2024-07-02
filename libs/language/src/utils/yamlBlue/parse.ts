import yaml from 'js-yaml';
import { YAML_BLUE_SCHEMA } from './schema';
import { JsonBlueValue } from '../../types';

/**
 * Parse YAML string
 */
export const yamlBlueParse = (value: string) =>
  yaml.load(value, { schema: YAML_BLUE_SCHEMA }) as JsonBlueValue | undefined;
