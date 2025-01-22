import { z } from 'zod';
import { serializeBlueAnnotated } from '../serializeBlueAnnotated';
import { withTypeBlueId } from '../annotations/typeBlueId';
import { blueIdField } from '../annotations/blueId';
import { blueNameField } from '../annotations/blueName';
import { blueDescriptionField } from '../annotations/blueDescription';

describe('serializeBlueAnnotated Tests', () => {
  // @TypeBlueId("Example-BlueId")
  // public class TypeBlueIdExample { public String field; }
  const TypeBlueIdExampleSchema = withTypeBlueId('Example-BlueId')(
    z.object({
      field: z.string().optional(),
    })
  );

  it('testTypeBlueIdSerialization', () => {
    const obj = { field: 'value' };
    const result = serializeBlueAnnotated(obj, TypeBlueIdExampleSchema);

    const expectedJson = `{"type":{"blueId":"Example-BlueId"},"field":"value"}`;
    expect(JSON.stringify(result)).toEqual(expectedJson);
  });

  // @TypeBlueId("BlueId-Example")
  // public class BlueIdExample { @BlueId public String id; }
  const BlueIdExampleSchema = withTypeBlueId('BlueId-Example')(
    z.object({
      id: blueIdField('id'),
    })
  );

  it('testBlueIdSerialization', () => {
    const obj = { id: '123' };
    const result = serializeBlueAnnotated(obj, BlueIdExampleSchema);

    const expectedJson = `{"type":{"blueId":"BlueId-Example"},"id":{"blueId":"123"}}`;
    expect(JSON.stringify(result)).toEqual(expectedJson);
  });

  // @TypeBlueId("Collection-Example")
  // public class CollectionExample {
  //   @BlueName("team") public String teamName;
  //   @BlueDescription("team") public String teamDescription;
  //   public List<String> team;
  // }
  const CollectionExampleSchema = withTypeBlueId('Collection-Example')(
    z.object({
      teamName: blueNameField('team'),
      teamDescription: blueDescriptionField('team'),
      team: z.array(z.string()).optional(),
    })
  );

  it('testBlueNameAndDescriptionForCollection', () => {
    const obj = {
      teamName: 'Dream Team',
      teamDescription: 'The best team ever',
      team: ['Alice', 'Bob', 'Charlie'],
    };

    const result = serializeBlueAnnotated(obj, CollectionExampleSchema);

    const expectedJson = `{"type":{"blueId":"Collection-Example"},"team":{"name":"Dream Team","description":"The best team ever","items":["Alice","Bob","Charlie"]}}`;
    expect(JSON.stringify(result)).toEqual(expectedJson);
  });

  // @TypeBlueId("NonCollection-Example")
  // public class NonCollectionExample {
  //   @BlueName("field") public String fieldName;
  //   @BlueDescription("field") public String fieldDescription;
  //   public String field;
  // }
  const NonCollectionExampleSchema = withTypeBlueId('NonCollection-Example')(
    z.object({
      fieldName: blueNameField('field'),
      fieldDescription: blueDescriptionField('field'),
      field: z.string().optional(),
    })
  );

  it('testBlueNameAndDescriptionForNonCollection', () => {
    const obj = {
      fieldName: 'Important Field',
      fieldDescription: 'This field is very important',
      field: 'Crucial data',
    };

    const result = serializeBlueAnnotated(obj, NonCollectionExampleSchema);

    const expectedJson = `{"type":{"blueId":"NonCollection-Example"},"field":{"name":"Important Field","description":"This field is very important","value":"Crucial data"}}`;
    expect(JSON.stringify(result)).toEqual(expectedJson);
  });
});
