import { yamlBlueDump } from '../dump';
import Big from 'big.js';

describe('yamlBlueDump', () => {
  it('dumps simple objects correctly', () => {
    const obj = { key: 'value', num: 123 };
    const dumpedYaml = yamlBlueDump(obj);
    expect(dumpedYaml).toMatchInlineSnapshot(`
      "key: value
      num: 123
      "
    `);
  });

  it('converts Big.js objects to numbers in YAML output', () => {
    const bigNum = new Big('1234.5678');
    const obj = { bigNum };
    const dumpedYaml = yamlBlueDump(obj);
    expect(dumpedYaml).toMatchInlineSnapshot(`
      "bigNum: 1234.5678
      "
    `);
  });

  it('handles nested structures with Big.js objects', () => {
    const nestedObj = {
      level1: {
        level2: {
          number: new Big('9876.54321'),
        },
      },
    };
    const dumpedYaml = yamlBlueDump(nestedObj);
    expect(dumpedYaml).toMatchInlineSnapshot(`
      "level1:
        level2:
          number: 9876.54321
      "
    `);
  });

  it('correctly serializes a small Big.js number', () => {
    const smallBigNum = new Big('0.0000000000000000000123456789');
    const dumpedYaml = yamlBlueDump({ smallBigNum });
    expect(dumpedYaml).toMatchInlineSnapshot(`
      "smallBigNum: 1.23456789e-20
      "
    `);
  });

  it('throws an error when attempting to serialize a Big.js number beyond JavaScript number limits', () => {
    const bigNum = new Big('1234567890123456789012345678901234567890');
    expect(() => yamlBlueDump({ bigNum })).toThrowErrorMatchingInlineSnapshot(
      `[Error: [big.js] Imprecise conversion]`
    );
  });
});
