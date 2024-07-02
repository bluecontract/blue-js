import yaml from 'js-yaml';
import { YAML_BLUE_SCHEMA } from './schema';
import { isBigNumber } from '../typeGuards';

/**
 * Dump any value to YAML string
 */
export const yamlBlueDump = (value: unknown) => {
  return yaml.dump(value, {
    schema: YAML_BLUE_SCHEMA,
    replacer: (_, value) => {
      return isBigNumber(value) ? value.toNumber() : value;
    },
  });
};
