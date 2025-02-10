import z from 'zod';
import { BigIntegerNumber, NodeDeserializer } from '../../model';
import { JsonBlueValue } from '../../../schema/jsonBlue';
import { yamlBlueParse } from '../../../utils/yamlBlue';
import {
  INTEGER_TYPE_BLUE_ID,
  LIST_TYPE_BLUE_ID,
  TEXT_TYPE_BLUE_ID,
} from '../../utils/Properties';
import { BlueIdCalculator, Properties } from '../../utils';
import { schemas, TestEnum } from './schema';
import { TypeSchemaResolver } from '../../utils/TypeSchemaResolver';
import { NodeToObjectConverter } from '../NodeToObjectConverter';
import { getBlueObjectValue } from '../../../utils/blueObject/getters';
import { BlueObject, isBlueObject } from '../../../schema';

const {
  doctorSchema,
  nurseSchema,
  personSchema,
  personDictionaryExampleSchema,
  personListExampleSchema,
  personObjectExampleSchema,
  personValueExampleSchema,
  xSchema,
  y1Schema,
  x1Schema,
  x2Schema,
  x3Schema,
  x11Schema,
  x12Schema,
} = schemas;

describe('blueNodeToObject', () => {
  let converter: NodeToObjectConverter;

  beforeEach(() => {
    const resolver = new TypeSchemaResolver(Object.values(schemas));
    converter = new NodeToObjectConverter(resolver);
  });

  it('should convert a string value to a string', () => {
    const node = NodeDeserializer.deserialize(
      yamlBlueParse('Hello') as JsonBlueValue
    );

    const result = converter.convert(node, z.string());
    expect(result).toBe('Hello');
  });

  it('should convert a blue node to an object of type Person', () => {
    const yaml =
      'type:\n' +
      '  blueId: AnnotatedPerson-BlueId\n' +
      'name: John Doe\n' +
      'surname: Doe\n' +
      'age: 30\n' +
      'personalInfo:\n' +
      '  name: John Doe\n' +
      '  description: A software engineer\n' +
      'hobbies:\n' +
      '  - name: Reading\n' +
      '    description: Reading books\n' +
      '    duration: 30';

    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue
    );

    const hobbySchema = z.object({
      name: z.string(),
      description: z.string().optional(),
      duration: z.number().optional(),
    });

    const hobbiesSchema = z.array(hobbySchema);

    const personSchema = z.object({
      age: z.number(),
      name: z.string(),
      surname: z.string(),
      personalInfo: z.object({
        name: z.string(),
        description: z.string(),
      }),
      hobbies: hobbiesSchema,
    });

    const result = converter.convert(node, personSchema);

    expect(result).toMatchInlineSnapshot(`
        {
          "age": 30,
          "hobbies": [
            {
              "description": "Reading books",
              "duration": 30,
              "name": "Reading",
            },
          ],
          "name": "John Doe",
          "personalInfo": {
            "description": "A software engineer",
            "name": "John Doe",
          },
          "surname": "Doe",
        }
      `);
  });

  it('should handle lazy properties correctly', () => {
    const yaml = `
      name: Main Category
      rating: 10
      subcategories:
        - name: Subcategory 1
          rating: 9
        - name: Subcategory 2
          rating: 1
    `;

    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue
    );

    const baseCategorySchema = z.object({
      name: z.string(),
      rating: z.number().optional(),
    });

    type Category = z.infer<typeof baseCategorySchema> & {
      subcategories?: Category[];
    };

    const categorySchema: z.ZodType<Category> = baseCategorySchema.extend({
      subcategories: z.lazy(() => categorySchema.array()).optional(),
    });

    const result = converter.convert(node, categorySchema);

    expect(result).toMatchInlineSnapshot(`
          {
            "name": "Main Category",
            "rating": 10,
            "subcategories": [
              {
                "name": "Subcategory 1",
                "rating": 9,
              },
              {
                "name": "Subcategory 2",
                "rating": 1,
              },
            ],
          }
        `);
  });

  describe('additional tests', () => {
    it('should convert X with primitive fields - testXConversion', () => {
      const xYaml = `
      type:
        blueId: X-BlueId
      byteField: 127
      byteObjectField: -128
      shortField: 32767
      shortObjectField: -32768
      intField: 2147483647
      integerField: -2147483648
      longField: 9007199254740991
      longObjectField: -9007199254740991
      floatField: 3.14
      floatObjectField: -3.14
      doubleField: 3.141592653589793
      doubleObjectField: -3.141592653589793
      booleanField: true
      booleanObjectField: false
      charField: A
      characterField: Z
      stringField: Hello, World!
      bigIntegerField:
        type:
          blueId: ${Properties.INTEGER_TYPE_BLUE_ID}
        value: "123456789012345678901234567890"
      bigDecimalField:
        type:
          blueId: ${Properties.DOUBLE_TYPE_BLUE_ID}
        value: "3.14159265358979323846"
      enumField: SOME_ENUM_VALUE`;

      const node = NodeDeserializer.deserialize(
        yamlBlueParse(xYaml) as JsonBlueValue
      );

      const x = converter.convert(node, xSchema);

      expect(x).toBeDefined();
      expect(x.byteField).toBe(127);
      expect(x.byteObjectField).toBe(-128);
      expect(x.shortField).toBe(32767);
      expect(x.shortObjectField).toBe(-32768);
      expect(x.intField).toBe(2147483647);
      expect(x.integerField).toBe(-2147483648);
      expect(x.longField).toBe(9007199254740991); // Max safe integer in JS
      expect(x.longObjectField).toBe(-9007199254740991);
      expect(x.floatField).toBeCloseTo(3.14, 2);
      expect(x.floatObjectField).toBeCloseTo(-3.14, 2);
      expect(x.doubleField).toBeCloseTo(3.141592653589793, 15);
      expect(x.doubleObjectField).toBeCloseTo(-3.141592653589793, 15);
      expect(x.booleanField).toBe(true);
      expect(x.booleanObjectField).toBe(false);
      expect(x.charField).toBe('A');
      expect(x.characterField).toBe('Z');
      expect(x.stringField).toBe('Hello, World!');
      // expect(x.bigIntegerField).toBe('123456789012345678901234567890');
      // expect(x.bigDecimalField).toBe('3.14159265358979323846');
      expect(x.enumField).toBe(TestEnum.SOME_ENUM_VALUE);
    });

    it('should convert X1 with collections - testX1Conversion', () => {
      const x1Yaml = `
        type:
          blueId: X1-BlueId
        name: X1 Instance
        intField: 42
        stringField: X1 String
        intArrayField:
          type:
            blueId: ${LIST_TYPE_BLUE_ID}
          itemType:
            blueId: ${INTEGER_TYPE_BLUE_ID}
          items: [1, 2, 3, 4, 5]
        stringListField:
          type:
            blueId: ${LIST_TYPE_BLUE_ID}
          itemType:
            blueId: ${TEXT_TYPE_BLUE_ID}
          items:
            - apple
            - banana
            - cherry
        integerSetField:
          type:
            blueId: ${LIST_TYPE_BLUE_ID}
          itemType:
            blueId: ${INTEGER_TYPE_BLUE_ID}
          items: [10, 20, 30, 40, 50]
`;

      const jsonValue = yamlBlueParse(x1Yaml) as JsonBlueValue;
      const node = NodeDeserializer.deserialize(jsonValue);

      const x1 = converter.convert(node, x1Schema);

      expect(x1).toBeDefined();
      expect(x1.intField).toBe(42);
      expect(x1.stringField).toBe('X1 String');
      expect(x1.intArrayField).toEqual([1, 2, 3, 4, 5]);
      expect(x1.stringListField).toEqual(['apple', 'banana', 'cherry']);
      expect(x1.integerSetField).toBeInstanceOf(Set);
      expect(Array.from(x1.integerSetField ?? new Set())).toEqual([
        10, 20, 30, 40, 50,
      ]);
    });

    it('should convert X2 with map fields - testX2Conversion', () => {
      const x2Yaml = `
        name: X2 Instance
        type:
          blueId: X2-BlueId
        doubleField: 3.14159
        booleanField: true
        stringIntMapField:
          key1: 100
          key2: 200
          key3: 300`;

      const node = NodeDeserializer.deserialize(
        yamlBlueParse(x2Yaml) as JsonBlueValue
      );
      const x2 = converter.convert(node, x2Schema);

      expect(x2).toBeDefined();
      expect(x2.doubleField).toBeCloseTo(3.14159, 5);
      expect(x2.booleanField).toBe(true);
      expect(x2.stringIntMapField).toBeInstanceOf(Map);
      expect(x2.stringIntMapField).toEqual(
        new Map([
          ['key1', 100],
          ['key2', 200],
          ['key3', 300],
        ])
      );
    });

    /**
     * We don't have concurrent fields in TypeScript, so we cannot recreate this test fully from the JAVA version.
     */
    it('should convert X3 with concurrent fields - testX3Conversion', () => {
      const x3Yaml = `
        name: X3 Instance
        type:
          blueId: X3-BlueId
        longField: 1234567890
        atomicIntegerField: 42
        atomicLongField: 9876543210
        concurrentMapField:
          key1: 111
          key2: 222
          key3: 333`;

      const node = NodeDeserializer.deserialize(
        yamlBlueParse(x3Yaml) as JsonBlueValue
      );
      const x3 = converter.convert(node, x3Schema);

      expect(x3).toBeDefined();
      expect(x3.longField).toBe(1234567890);
      expect(x3.atomicIntegerField).toBe(42);
      expect(x3.atomicLongField).toBe(9876543210);
      expect(x3.concurrentMapField?.size).toBe(3);
      expect(x3.concurrentMapField?.get('key1')).toBe(111);
      expect(x3.concurrentMapField?.get('key2')).toBe(222);
      expect(x3.concurrentMapField?.get('key3')).toBe(333);
    });

    it('should convert X11 with nested collections - testX11Conversion', () => {
      const x11Yaml = `
        name: X11 Instance
        type:
          blueId: X11-BlueId
        intField: 11
        stringField: X11 String
        intArrayField: [11, 22, 33]
        stringListField: [red, green, blue]
        integerSetField: [111, 222, 333]
        nestedListField:
          - [a, b, c]
          - [d, e, f]
        complexMapField:
          key1: [1, 2, 3]
          key2: [4, 5, 6]`;

      const node = NodeDeserializer.deserialize(
        yamlBlueParse(x11Yaml) as JsonBlueValue
      );
      const x11 = converter.convert(node, x11Schema);

      expect(x11).toBeDefined();
      expect(x11.intField).toBe(11);
      expect(x11.stringField).toBe('X11 String');
      expect(x11.intArrayField).toEqual([11, 22, 33]);
      expect(x11.stringListField).toEqual(['red', 'green', 'blue']);
      expect(Array.from(x11.integerSetField ?? new Set())).toEqual([
        111, 222, 333,
      ]);

      expect(x11.nestedListField?.length).toBe(2);
      expect(x11.nestedListField?.[0]).toEqual(['a', 'b', 'c']);
      expect(x11.nestedListField?.[1]).toEqual(['d', 'e', 'f']);

      expect(x11.complexMapField?.size).toBe(2);
      expect(x11.complexMapField?.get('key1')).toEqual([1, 2, 3]);
      expect(x11.complexMapField?.get('key2')).toEqual([4, 5, 6]);
    });

    /**
     * We don't have queue and deque in TypeScript, so we cannot recreate this test fully from the JAVA version.
     */
    it('should convert X12 with queue and deque - testX12Conversion', () => {
      const x12Yaml = `
        name: X Variations
        type:
          blueId: X12-BlueId
        byteField: 100
        integerField: 1000
        stringField: Base X field
        intArrayField: [1, 2, 3, 4, 5]
        stringListField: [apple, banana, cherry]
        integerSetField: [10, 20, 30, 40, 50]
        stringQueueField: [first, second, third]
        integerDequeField: [1000, 2000, 3000]`;

      const node = NodeDeserializer.deserialize(
        yamlBlueParse(x12Yaml) as JsonBlueValue
      );
      const x12 = converter.convert(node, x12Schema);

      expect(x12).toBeDefined();
      expect(x12.byteField).toBe(100);
      expect(x12.integerField).toBe(1000);
      expect(x12.stringField).toBe('Base X field');
      expect(x12.intArrayField).toEqual([1, 2, 3, 4, 5]);
      expect(x12.stringListField).toEqual(['apple', 'banana', 'cherry']);
      expect(Array.from(x12.integerSetField ?? new Set())).toEqual([
        10, 20, 30, 40, 50,
      ]);

      expect(x12.stringQueueField).toEqual(['first', 'second', 'third']);
      expect(x12.integerDequeField).toEqual([1000, 2000, 3000]);
    });

    it('should convert Y with nested objects and collections - testYConversion', () => {
      const yYaml = `
        name: Y Instance
        type:
          blueId: Y-BlueId
        xField:
          type:
            blueId: X-BlueId
          intField: 100
          stringField: X in Y
        x1Field:
          type:
            blueId: X1-BlueId
          intArrayField: [1, 2, 3]
          stringListField: [a, b, c]
        x2Field:
          type:
            blueId: X2-BlueId
          stringIntMapField:
            key1: 10
            key2: 20
        xListField:
          - type:
              blueId: X-BlueId
            intField: 1
          - type:
              blueId: X-BlueId
            intField: 2
        xMapField:
          key1:
            type:
              blueId: X-BlueId
            intField: 10
          key2:
            type:
              blueId: X-BlueId
            intField: 20
        x1SetField:
          - type:
              blueId: X1-BlueId
            intArrayField: [4, 5, 6]
          - type:
              blueId: X1-BlueId
            intArrayField: [7, 8, 9]
        x2MapField:
          mapKey1:
            type:
              blueId: X2-BlueId
            stringIntMapField:
              innerKey1: 30
              innerKey2: 40
          mapKey2:
            type:
              blueId: X2-BlueId
            stringIntMapField:
              innerKey3: 50
              innerKey4: 60
        xArrayField:
          - type:
              blueId: X-BlueId
            intField: 100
          - type:
              blueId: X-BlueId
            intField: 200
        wildcardXListField:
          - type:
              blueId: X1-BlueId
            intArrayField: [10, 11, 12]
          - type:
              blueId: X2-BlueId
            stringIntMapField:
              wildcardKey: 70`;

      const node = NodeDeserializer.deserialize(
        yamlBlueParse(yYaml) as JsonBlueValue
      );

      const y = converter.convert(node, y1Schema);

      // Basic validation
      expect(y).toBeDefined();

      // xField validation
      expect(y.xField).toBeDefined();
      expect(y.xField?.intField).toBe(100);
      expect(y.xField?.stringField).toBe('X in Y');

      // x1Field validation
      expect(y.x1Field).toBeDefined();
      expect(y.x1Field?.intArrayField).toEqual([1, 2, 3]);
      expect(y.x1Field?.stringListField).toEqual(['a', 'b', 'c']);

      // x2Field validation
      expect(y.x2Field).toBeDefined();
      expect(y.x2Field?.stringIntMapField?.get('key1')).toBe(10);
      expect(y.x2Field?.stringIntMapField?.get('key2')).toBe(20);

      // xListField validation
      expect(y.xListField).toBeDefined();
      expect(y.xListField?.length).toBe(2);
      expect(y.xListField?.[0].intField).toBe(1);
      expect(y.xListField?.[1].intField).toBe(2);

      // xMapField validation
      expect(y.xMapField).toBeDefined();
      expect(y.xMapField?.size).toBe(2);
      expect(y.xMapField?.get('key1')?.intField).toBe(10);
      expect(y.xMapField?.get('key2')?.intField).toBe(20);

      // x1SetField validation
      expect(y.x1SetField).toBeDefined();
      expect(y.x1SetField?.size).toBe(2);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const x1SetArray = Array.from(y.x1SetField!);
      expect(
        x1SetArray.some(
          (x1) => JSON.stringify(x1.intArrayField) === JSON.stringify([4, 5, 6])
        )
      ).toBe(true);
      expect(
        x1SetArray.some(
          (x1) => JSON.stringify(x1.intArrayField) === JSON.stringify([7, 8, 9])
        )
      ).toBe(true);

      // x2MapField validation
      expect(y.x2MapField).toBeDefined();
      expect(y.x2MapField?.size).toBe(2);
      expect(
        y.x2MapField?.get('mapKey1')?.stringIntMapField?.get('innerKey1')
      ).toBe(30);
      expect(
        y.x2MapField?.get('mapKey1')?.stringIntMapField?.get('innerKey2')
      ).toBe(40);
      expect(
        y.x2MapField?.get('mapKey2')?.stringIntMapField?.get('innerKey3')
      ).toBe(50);
      expect(
        y.x2MapField?.get('mapKey2')?.stringIntMapField?.get('innerKey4')
      ).toBe(60);

      // xArrayField validation
      expect(y.xArrayField).toBeDefined();
      expect(y.xArrayField?.length).toBe(2);
      expect(y.xArrayField?.[0].intField).toBe(100);
      expect(y.xArrayField?.[1].intField).toBe(200);

      // wildcardXListField validation
      expect(y.wildcardXListField).toBeDefined();
      expect(y.wildcardXListField?.length).toBe(2);

      const firstWildcard = y.wildcardXListField?.[0];
      const secondWildcard = y.wildcardXListField?.[1];

      const resultX1 = x1Schema.safeParse(firstWildcard);
      expect(resultX1.success).toBeTruthy();
      expect(resultX1.data?.intArrayField).toEqual([10, 11, 12]);

      const resultX2 = x2Schema.safeParse(secondWildcard);
      expect(resultX2.success).toBeTruthy();
      expect(resultX2.data?.stringIntMapField?.get('wildcardKey')).toBe(70);
    });

    it('should convert Y1 with nested objects and collections - testY1Conversion', () => {
      const y1Yaml = `
        name: Y1 Instance
        type:
          blueId: Y1-BlueId
        xField:
          type:
            blueId: X-BlueId
          intField: 100
        x11Field:
          type:
            blueId: X11-BlueId
          nestedListField:
            - [a, b, c]
            - [d, e, f]
        x12Field:
          type:
            blueId: X12-BlueId
          stringQueueField: [first, second, third]
        x11ListField:
          - type:
              blueId: X11-BlueId
            complexMapField:
              key1: [1, 2, 3]
          - type:
              blueId: X11-BlueId
            complexMapField:
              key2: [4, 5, 6]`;

      const node = NodeDeserializer.deserialize(
        yamlBlueParse(y1Yaml) as JsonBlueValue
      );

      const result = converter.convert(node, y1Schema);

      expect(result).toBeDefined();
      expect(result.xField?.intField).toBe(100);
      expect(result.x11Field?.nestedListField).toHaveLength(2);
      expect(result.x11Field?.nestedListField?.[0]).toEqual(['a', 'b', 'c']);
      expect(result.x11Field?.nestedListField?.[1]).toEqual(['d', 'e', 'f']);
      expect(result.x12Field?.stringQueueField).toEqual([
        'first',
        'second',
        'third',
      ]);
      expect(result.x11ListField).toHaveLength(2);
      expect(result.x11ListField?.[0]?.complexMapField?.get('key1')).toEqual([
        1, 2, 3,
      ]);
      expect(result.x11ListField?.[1]?.complexMapField?.get('key2')).toEqual([
        4, 5, 6,
      ]);
    });

    it('should handle different object variants correctly - testObjectVariants', () => {
      const personTestDataYaml = `
        name: Person Testing
        type:
          blueId: PersonTestData-BlueId
        alice1:
          name: Alice
          surname: Smith
          age: 25
        alice2:
          name: Alice
          surname: Smith
          age: 25
        alice3:
          name: Alice
          surname: Smith
          age: 25
        alice4:
          name: Alice
          surname: Smith
          age: 25
        alice5:
          type:
            blueId: Nurse-BlueId
          name: Alice
          surname: Smith
          age: 25
          yearsOfExperience: 4`;

      const node = NodeDeserializer.deserialize(
        yamlBlueParse(personTestDataYaml) as JsonBlueValue
      );

      const result = converter.convert(node, personObjectExampleSchema);

      expect(result).toBeDefined();

      // Test alice1
      expect(result.alice1).toBeDefined();
      expect(result.alice1).toBe(
        BlueIdCalculator.calculateBlueIdSync(result?.alice2)
      );

      // Test alice2
      const alice2 = result.alice2;
      expect(alice2).toBeDefined();
      expect(alice2?.getName()).toBe('Alice');
      expect(alice2?.getProperties()?.['surname'].getValue()).toBe('Smith');
      expect(alice2?.getProperties()?.['age'].getValue()).toEqual(
        new BigIntegerNumber(25)
      );

      // Test alice3
      const alice3 = result.alice3;
      expect(alice3).toBeDefined();
      expect(alice3?.name).toBe('Alice');
      expect(isBlueObject(alice3?.surname)).toBeTruthy();
      expect(getBlueObjectValue(alice3?.surname as BlueObject)).toBe('Smith');
      expect(isBlueObject(alice3?.age)).toBeTruthy();
      expect(getBlueObjectValue(alice3?.age as BlueObject)).toBe(25);

      // Test alice4
      expect(result.alice4).toBeDefined();
      expect(result.alice4?.name).toBe('Alice');
      expect(result.alice4?.surname).toBe('Smith');
      expect(result.alice4?.age).toBe(25);

      // Test alice5 (Nurse)
      expect(result.alice5).toBeDefined();
      const resultNurse = nurseSchema.safeParse(result.alice5);
      expect(resultNurse.success).toBeTruthy();
      expect(resultNurse.data?.name).toBe('Alice');
      expect(resultNurse.data?.surname).toBe('Smith');
      expect(resultNurse.data?.age).toBe(25);
      expect(resultNurse.data?.yearsOfExperience).toBe(4);
    });

    it('should handle different value variants correctly - testValueVariants', () => {
      const personTestDataYaml = `
        type:
          blueId: PersonValue-BlueId
        age1:
          type:
            blueId: DHmxTkFbXePZHCHCYmQr2dSzcNLcryFVjXVHkdQrrZr8
          name: Official Age
          description: Description for official age
          value: 25
        age2:
          type:
            blueId: DHmxTkFbXePZHCHCYmQr2dSzcNLcryFVjXVHkdQrrZr8
          name: Official Age
          description: Description for official age
          value: 25
        age3:
          type:
            blueId: DHmxTkFbXePZHCHCYmQr2dSzcNLcryFVjXVHkdQrrZr8
          name: Official Age
          description: Description for official age
          value: 25`;

      const jsonValue = yamlBlueParse(personTestDataYaml) as JsonBlueValue;
      const node = NodeDeserializer.deserialize(jsonValue);

      const result = converter.convert(node, personValueExampleSchema);

      // Basic validation
      expect(result).toBeDefined();

      // Test age1 (direct value)
      expect(result.age1).toBe(25);

      // Test age2 (value with metadata)
      expect(result.age2).toBe(25);
      expect(result.age2Name).toBe('Official Age');
      expect(result.age2Description).toBe('Description for official age');

      // Test age3 (full value object)
      expect(result.age3).toBeDefined();
      expect(result.age3?.getName()).toBe('Official Age');
      expect(result.age3?.getDescription()).toBe(
        'Description for official age'
      );
      expect(result.age3Name).toBe('Official Age');
      expect(result.age3?.getType()?.getBlueId()).toBe(
        'DHmxTkFbXePZHCHCYmQr2dSzcNLcryFVjXVHkdQrrZr8'
      );
      expect(result.age3?.getValue()).toEqual(new BigIntegerNumber(25));
      expect(node.getType()?.getBlueId()).toBe('PersonValue-BlueId');
    });

    it('should handle different list variants correctly - testListVariants', () => {
      const personTestDataYaml = `
        type:
          blueId: PersonList-BlueId
        team1:
          - type:
              blueId: Doctor-BlueId
            name: Adam
            specialization: surgeon
          - type:
              blueId: Nurse-BlueId
            name: Betty
            yearsOfExperience: 12
        team2:
          name: Team2 Name
          description: Team2 Description
          items:
            - type:
                blueId: Doctor-BlueId
              name: Adam
              specialization: surgeon
            - type:
                blueId: Nurse-BlueId
              name: Betty
              yearsOfExperience: 12
        team3:
          - type:
              blueId: Doctor-BlueId
            name: Adam
            specialization: surgeon
          - type:
              blueId: Nurse-BlueId
            name: Betty
            yearsOfExperience: 12`;

      const node = NodeDeserializer.deserialize(
        yamlBlueParse(personTestDataYaml) as JsonBlueValue
      );

      const result = converter.convert(node, personListExampleSchema);

      // Basic validation
      expect(result).toBeDefined();

      // Test team1
      expect(result.team1).toBeDefined();
      expect(result.team1).toHaveLength(2);

      const doctor1 = doctorSchema.safeParse(result.team1[0]);
      expect(doctor1.success).toBeTruthy();
      const nurse1 = nurseSchema.safeParse(result.team1[1]);
      expect(nurse1.success).toBeTruthy();

      expect(doctor1.data?.name).toBe('Adam');
      expect(doctor1.data?.specialization).toBe('surgeon');

      expect(nurse1.data?.name).toBe('Betty');
      expect(nurse1.data?.yearsOfExperience).toBe(12);

      // Test team2
      expect(result.team2Name).toBe('Team2 Name');
      expect(result.team2Description).toBe('Team2 Description');
      expect(result.team2).toHaveLength(2);

      const doctor2 = doctorSchema.safeParse(result.team2[0]);
      expect(doctor2.success).toBeTruthy();
      const nurse2 = nurseSchema.safeParse(result.team2[1]);
      expect(nurse2.success).toBeTruthy();

      expect(doctor2.data?.name).toBe('Adam');
      expect(doctor2.data?.specialization).toBe('surgeon');

      expect(nurse2.data?.name).toBe('Betty');
      expect(nurse2.data?.yearsOfExperience).toBe(12);

      // Test team3
      expect(result.team3).toBeDefined();
      expect(result.team3.getItems()).toHaveLength(2);

      const doctorNode = result.team3.getItems()?.[0];
      const nurseNode = result.team3.getItems()?.[1];

      expect(doctorNode?.getName()).toBe('Adam');
      expect(doctorNode?.getType()?.getBlueId()).toBe('Doctor-BlueId');
      expect(doctorNode?.getProperties()?.['specialization'].getValue()).toBe(
        'surgeon'
      );

      expect(nurseNode?.getName()).toBe('Betty');
      expect(nurseNode?.getType()?.getBlueId()).toBe('Nurse-BlueId');
      expect(
        nurseNode?.getProperties()?.['yearsOfExperience'].getValue()
      ).toEqual(new BigIntegerNumber(12));

      // Test node type
      expect(node.getType()?.getBlueId()).toBe('PersonList-BlueId');
    });

    it('should handle different dictionary variants correctly - testDictionaryVariants', () => {
      const personTestDataYaml = `
          team1:
            person1:
              type:
                blueId: Doctor-BlueId
              name: Adam
              specialization: surgeon
            person2:
              type:
                blueId: Nurse-BlueId
              name: Betty
              yearsOfExperience: 12
          team2:
            person1:
              type:
                blueId: Doctor-BlueId
              name: Adam
              specialization: surgeon
            person2:
              type:
                blueId: Nurse-BlueId
              name: Betty
              yearsOfExperience: 12
          team3:
            1:
              type:
                blueId: Doctor-BlueId
              name: Adam
              specialization: surgeon
            2:
              type:
                blueId: Nurse-BlueId
              name: Betty
              yearsOfExperience: 12`;

      const node = NodeDeserializer.deserialize(
        yamlBlueParse(personTestDataYaml) as JsonBlueValue
      );

      const result = converter.convert(node, personDictionaryExampleSchema);
      expect(() => personDictionaryExampleSchema.parse(result)).not.toThrow();
      expect(result).toBeDefined();

      // Test team1
      expect(result.team1).toBeDefined();
      expect(result.team1.size).toBe(2);

      const doctor1 = doctorSchema.safeParse(result.team1.get('person1'));
      expect(doctor1.success).toBeTruthy();
      const nurse1 = nurseSchema.safeParse(result.team1.get('person2'));
      expect(nurse1.success).toBeTruthy();

      expect(doctor1.data?.name).toBe('Adam');
      expect(doctor1.data?.specialization).toBe('surgeon');
      expect(nurse1.data?.name).toBe('Betty');
      expect(nurse1.data?.yearsOfExperience).toBe(12);

      // Test team2
      expect(result.team2).toBeDefined();
      expect(result.team2.size).toBe(2);

      const doctor2 = doctorSchema.safeParse(result.team2.get('person1'));
      expect(doctor2.success).toBeTruthy();
      const nurse2 = nurseSchema.safeParse(result.team2.get('person2'));
      expect(nurse2.success).toBeTruthy();

      expect(doctor2.data?.name).toBe('Adam');
      expect(doctor2.data?.specialization).toBe('surgeon');
      expect(nurse2.data?.name).toBe('Betty');
      expect(nurse2.data?.yearsOfExperience).toBe(12);

      // Test team3
      expect(result.team3).toBeDefined();
      expect(result.team3.size).toBe(2);

      const doctor3 = doctorSchema.safeParse(result.team3.get(1));
      expect(doctor3.success).toBeTruthy();
      const nurse3 = nurseSchema.safeParse(result.team3.get(2));
      expect(nurse3.success).toBeTruthy();

      expect(doctor3.data?.name).toBe('Adam');
      expect(doctor3.data?.specialization).toBe('surgeon');
      expect(nurse3.data?.name).toBe('Betty');
      expect(nurse3.data?.yearsOfExperience).toBe(12);
    });

    it('should convert a simple object correctly - testObjectSimple', () => {
      const personTestDataYaml = `
        type:
          blueId: Nurse-BlueId
        name: Alice
        surname: Smith
        age: 25
        yearsOfExperience: 4`;

      const node = NodeDeserializer.deserialize(
        yamlBlueParse(personTestDataYaml) as JsonBlueValue
      );

      const result = converter.convert(node, personSchema);

      expect(result).toBeDefined();

      const nurseResult = nurseSchema.safeParse(result);
      expect(nurseResult.success).toBeTruthy();

      const nurse = nurseResult.data;
      expect(nurse?.name).toBe('Alice');
      expect(nurse?.surname).toBe('Smith');
      expect(nurse?.age).toBe(25);
      expect(nurse?.yearsOfExperience).toBe(4);
    });

    it('should convert a simple object with extended schema correctly - testObjectSimpleExtended', () => {
      const personTestDataYaml = `
        type:
          blueId: X12-BlueId
        stringQueueField:
          - A
          - B
          - C`;

      const node = NodeDeserializer.deserialize(
        yamlBlueParse(personTestDataYaml) as JsonBlueValue
      );
      const result = converter.convert(node, xSchema);

      expect(result).toBeDefined();
      const parsedResult = x12Schema.safeParse(result);
      expect(parsedResult.success).toBeTruthy();
      expect(parsedResult.data?.stringQueueField).toHaveLength(3);
    });
  });
});
