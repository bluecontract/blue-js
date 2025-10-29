import { describe, it, expect } from 'vitest';
import { Big } from 'big.js';
import { jsonBlueValueSchema } from '../jsonBlue';

describe('jsonBlueValueSchema', () => {
  const testValidation = (data: unknown, expectedResult: boolean) => {
    if (expectedResult) {
      expect(() => jsonBlueValueSchema.parse(data)).not.toThrow();
    } else {
      expect(() => jsonBlueValueSchema.parse(data)).toThrow();
    }
  };

  it('validates primitive types', () => {
    testValidation('string', true); // String
    testValidation(123, true); // Number
    testValidation(true, true); // Boolean
    testValidation(null, true); // Null
    testValidation(undefined, false); // Undefined is not allowed
  });

  it('validates Big.js instance', () => {
    testValidation(new Big('123'), true); // Big.js instance
  });

  it('validates simple objects', () => {
    testValidation({}, true); // Object without properties
    testValidation({ key: 'value' }, true); // Object with string value
    testValidation({ key: 123 }, true); // Object with number value
    testValidation({ key: true }, true); // Object with boolean value
    testValidation({ key: null }, true); // Object with null value
  });

  it('validates nested objects', () => {
    testValidation({ key: { nestedKey: 'nestedValue' } }, true); // Nested object
  });

  it('validates arrays', () => {
    testValidation(['string', 123, true, null], true); // Array with mixed primitives
    testValidation([new Big('123'), { key: 'value' }], true); // Array with Big.js instance and object
  });

  it('validates readonly arrays', () => {
    testValidation(Object.freeze(['string', 123]), true); // Readonly array
  });

  it('validates complex nested structures', () => {
    testValidation({ key: ['string', { nestedKey: new Big('456') }] }, true); // Object with nested array and Big.js instance

    testValidation(
      {
        user: {
          name: {
            first: 'John',
            last: 'Doe',
          },
          age: 30,
          address: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            zip: '10001',
          },
          hobbies: ['reading', 'painting', 'gaming'],
          random: {
            key: 'value',
            nested: {
              anotherKey: 'another value',
            },
            array: [
              1,
              {
                key: 'value',
                nested: {
                  anotherKey: 'another value',
                },
              },
              new Big('456'),
            ],
          },
        },
      },
      true,
    );
  });

  it('invalidates incorrect values', () => {
    testValidation({ key: undefined }, false); // Object with undefined value
    testValidation([{ key: undefined }], false); // Array with object containing undefined value
    testValidation(new Date(), false); // Date object is not allowed
    testValidation(Symbol('symbol'), false); // Symbol is not allowed

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    testValidation(() => {}, false); // Function is not allowed
  });
});
