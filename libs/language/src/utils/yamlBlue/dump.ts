import yaml from 'js-yaml';
import { YAML_BLUE_SCHEMA } from './schema';
import { isBigIntegerNumber, isBigNumber } from '../typeGuards';
import Big from 'big.js';

/**
 * Dump any value to YAML string
 */
export const yamlBlueDump = (value: unknown) => {
  return yaml.dump(value, {
    schema: YAML_BLUE_SCHEMA,
    replacer: (_, value) => {
      if (isBigNumber(value)) {
        if (isBigIntegerNumber(value)) {
          const lowerBound = new Big(Number.MIN_SAFE_INTEGER.toString());
          const upperBound = new Big(Number.MAX_SAFE_INTEGER.toString());

          if (value.lt(lowerBound) || value.gt(upperBound)) {
            return value.toString();
          }
        }

        return value.toNumber();
      }
      return value;
    },
  });
};
