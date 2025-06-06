import yaml from 'js-yaml';
import { isPreciseNumberString } from '@blue-labs/shared-utils';
import { BigIntegerNumber } from '../../../lib/model';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const intTypeOptions = (yaml as any).types.int
  .options as yaml.TypeConstructorOptions;

const options = {
  ...intTypeOptions,
  construct: (data) => {
    let value = data;

    if (value.indexOf('_') !== -1) {
      value = value.replace(/_/g, '');
    }

    if (!isPreciseNumberString(value)) {
      return new BigIntegerNumber(value);
    }

    if (intTypeOptions.construct) {
      return intTypeOptions.construct(data);
    }
  },
} as yaml.TypeConstructorOptions;

export const IntType = new yaml.Type('tag:yaml.org,2002:int', options);
