import yaml from 'js-yaml';
import { isPreciseNumberString } from '@blue-labs/shared-utils';
import { BigDecimalNumber } from '../../../lib/model';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const floatTypeOptions = (yaml as any).types.float
  .options as yaml.TypeConstructorOptions;

const options = {
  ...floatTypeOptions,
  construct: (data) => {
    const value = data.replace(/_/g, '').toLowerCase();

    if (!isPreciseNumberString(value)) {
      return new BigDecimalNumber(value);
    }

    if (floatTypeOptions.construct) {
      return floatTypeOptions.construct(data);
    }
  },
} as yaml.TypeConstructorOptions;

export const FloatType = new yaml.Type('tag:yaml.org,2002:float', options);
