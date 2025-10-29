import { omit } from 'radash';
import { Properties } from '../../lib';
import { Writable, ArrayValues } from 'type-fest';
import { isNullable } from '@blue-labs/shared-utils';

type ObjectSpecificKeys = ArrayValues<typeof Properties.OBJECT_SPECIFIC_KEYS>;

export const getBlueObjectProperties = <T extends Record<string, unknown>>(
  blueObject?: T,
): Omit<T, ObjectSpecificKeys> =>
  isNullable(blueObject)
    ? ({} as Omit<T, ObjectSpecificKeys>)
    : omit(
        blueObject,
        Properties.OBJECT_SPECIFIC_KEYS as Writable<
          typeof Properties.OBJECT_SPECIFIC_KEYS
        >,
      );
