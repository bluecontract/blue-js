import {
  normalizeToBlueObject,
  yamlBlueParse,
  JsonBlueValue,
} from '@blue-company/language';
import { isString } from 'radash';
import { contractSchema } from './schema';

const getJsonValue = (content: string | JsonBlueValue) => {
  if (isString(content)) {
    return yamlBlueParse(content) ?? null;
  }

  return content;
};

/**
 * Parse the given content as a contract.
 * Throws an error if the content is not a valid contract.
 */
export const parseAsContract = (content: string | JsonBlueValue) => {
  const jsonValue = getJsonValue(content);
  const blueObject = normalizeToBlueObject(jsonValue);
  return contractSchema.parse(blueObject);
};
