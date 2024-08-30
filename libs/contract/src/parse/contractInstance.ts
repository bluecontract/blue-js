import {
  yamlBlueParse,
  JsonBlueValue,
  jsonBlueValueSchema,
} from '@blue-company/language';
import { isObject, isString } from 'radash';
import { contractInstanceSchema, ContractInstance } from '../schema';
import { parseAsContract } from './contract';
import { isReadonlyArray } from '@blue-company/shared-utils';

const getJsonValue = (content: string | JsonBlueValue) => {
  if (isString(content)) {
    return yamlBlueParse(content) ?? null;
  }

  return content;
};

/**
 * Parse the given content as a contract instance.
 * Throws an error if the content is not a valid contract instance.
 */
export const parseAsContractInstance = (
  content: string | JsonBlueValue
): ContractInstance => {
  const jsonValue = getJsonValue(content);
  if (!isObject(jsonValue) || isReadonlyArray(jsonValue)) {
    throw new Error('Invalid contract instance');
  }

  let contractState = undefined;

  if ('contractState' in jsonValue && jsonValue['contractState']) {
    const jsonContract = jsonBlueValueSchema.parse(jsonValue['contractState']);
    contractState = parseAsContract(jsonContract);
  }

  return contractInstanceSchema.parse({
    ...jsonValue,
    contractState,
  });
};
