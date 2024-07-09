import { pascal } from 'radash';
import {
  BlueObject,
  hasBlueObjectItemsDefined,
  hasBlueObjectTypeDefined,
  hasBlueObjectValueDefined,
} from '../../schema';

/**
 * Get the type label of a BlueObject based on its type, value, or items.
 */
export const getBlueObjectTypeLabel = (blueObject: BlueObject) => {
  if (hasBlueObjectTypeDefined(blueObject)) {
    return blueObject.type.name ?? null;
  }

  if (hasBlueObjectValueDefined(blueObject)) {
    return pascal(typeof blueObject.value);
  }

  if (hasBlueObjectItemsDefined(blueObject)) {
    return 'List';
  }

  return null;
};
