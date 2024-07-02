import { omit } from 'radash';
import { Properties } from '../../lib';
import { Writable } from 'type-fest';
import { isNullable } from '../typeGuards';

export const getBlueObjectProperties = <T extends Record<string, unknown>>(
  blueObject?: T
) =>
  isNullable(blueObject)
    ? {}
    : omit(
        blueObject,
        Properties.OBJECT_SPECIFIC_KEYS as Writable<
          typeof Properties.OBJECT_SPECIFIC_KEYS
        >
      );
