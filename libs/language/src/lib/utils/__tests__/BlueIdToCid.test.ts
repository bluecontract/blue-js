import { NodeDeserializer } from '../../model';
import { BlueIdCalculator } from '../BlueIdCalculator';
import { BlueIdToCid } from '../BlueIdToCid';
import { CidToBlueId } from '../CidToBlueId';
import { calculateCidFromObject } from './calculateCID';

describe('BlueIdToCid', () => {
  test('should convert blueId to CID correctly', () => {
    const sampleBlueId = '9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs';
    const expectedCid =
      'bafkreiecgsz2wsewq5d34oslw57u75gvqdxt4h6vze3z2tytqnrkevdvla';

    const result = BlueIdToCid.convert(sampleBlueId);

    expect(result).toBe(expectedCid);
  });

  test('should convert blueId to CID correctly for different blueId lengths', () => {
    const sampleBlueId = 'gVX8re5joC7U7MWa2Mzx8jAxwEny41bns7T9aPqdJdP';
    const expectedCid =
      'bafkreiakdxtbh5mcnv4dwfvcjzgtvwut7zn52pxhx6w6vijmtjrqsuemii';

    const result = BlueIdToCid.convert(sampleBlueId);

    expect(result).toBe(expectedCid);
  });

  test('should throw an error for invalid blueId', () => {
    expect(() => BlueIdToCid.convert('invalidBlueId')).toThrow(
      'Non-base58 character'
    );
  });

  test('should round trip conversion between blueId and CID', () => {
    const sampleBlueId = '9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs';
    const cid = BlueIdToCid.convert(sampleBlueId);
    const blueId = CidToBlueId.convert(cid);

    expect(blueId).toBe(sampleBlueId);
  });
});

describe('BlueIdToCid - additional tests', async () => {
  const image = {
    type: {
      blueId: 'F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP',
    },
    value: '/images/bruschetta.webp',
  };
  const imageNode = NodeDeserializer.deserialize(image);
  const imageBlueId = await BlueIdCalculator.calculateBlueId(imageNode);

  const price = {
    type: {
      blueId: '68ryJtnmui4j5rCZWUnkZ3DChtmEb7Z9F8atn1mBSM3L',
    },
    value: 7.5,
  };

  const priceNode = NodeDeserializer.deserialize(price);
  const priceBlueId = await BlueIdCalculator.calculateBlueId(priceNode);

  const dish = {
    name: 'Bruschetta al Pomodoro',
    description:
      'Grilled bread rubbed with garlic and topped with diced tomatoes, olive oil, and fresh basil.',
    type: {
      blueId: 'FSJRd4DZCHRZnc5j2KvzQDuQRJXnkdJAvUAF7b7gSyxk',
    },
    image,
    price,
  };
  const dishNode = NodeDeserializer.deserialize(dish);
  const dishBlueId = await BlueIdCalculator.calculateBlueId(dishNode);

  test.each([
    [image, imageBlueId],
    [price, priceBlueId],
  ])(
    'should produce identical CIDs from BlueId and content for %s',
    async (value, valueBlueId) => {
      const cidFromBlueId = BlueIdToCid.convert(valueBlueId);

      const cid = await calculateCidFromObject(value);

      expect(cidFromBlueId).toBe(cid);
    }
  );

  test('should produce identical CIDs from BlueId and content for dish object', async () => {
    const cidFromBlueId = BlueIdToCid.convert(dishBlueId);

    const processedDish = {
      ...dish,
      image: {
        blueId: imageBlueId,
      },
      price: {
        blueId: priceBlueId,
      },
    };

    const cid = await calculateCidFromObject(processedDish);

    expect(cidFromBlueId).toBe(cid);
  });

  describe('BlueIdToCid - array handling', async () => {
    const ingredients = [
      {
        type: {
          blueId: 'F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP',
        },
        value: 'Bread',
      },
      {
        type: {
          blueId: 'F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP',
        },
        value: 'Tomatoes',
      },
      {
        type: {
          blueId: 'F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP',
        },
        value: 'Olive oil',
      },
    ];

    const ingredientsNode = NodeDeserializer.deserialize(ingredients);
    const ingredientsBlueId = await BlueIdCalculator.calculateBlueId(
      ingredientsNode
    );

    const dishWithIngredients = {
      ...dish,
      ingredients,
    };
    const dishWithIngredientsNode =
      NodeDeserializer.deserialize(dishWithIngredients);
    const dishWithIngredientsBlueId = await BlueIdCalculator.calculateBlueId(
      dishWithIngredientsNode
    );

    const twoIngredients = ingredients.slice(0, 2);

    test('should generate identical CIDs for array of ingredients using different methods', async () => {
      const ingredientsNodes = twoIngredients.map((ingredient) =>
        NodeDeserializer.deserialize(ingredient)
      );
      const blueId = await BlueIdCalculator.calculateBlueId(ingredientsNodes);
      const cidFromBlueId = BlueIdToCid.convert(blueId);

      const ingredientsBlueIds = await Promise.all(
        twoIngredients.map(async (ingredient) => {
          const ingredientNode = NodeDeserializer.deserialize(ingredient);
          const blueId = await BlueIdCalculator.calculateBlueId(ingredientNode);
          return { blueId };
        })
      );

      const cid = await calculateCidFromObject(ingredientsBlueIds);
      expect(cidFromBlueId).toBe(cid);
    });

    test('should produce identical CIDs for dish with ingredients array using BlueId and content', async () => {
      const cidFromBlueId = BlueIdToCid.convert(dishWithIngredientsBlueId);

      const processedDish = {
        ...dish,
        ingredients: {
          blueId: ingredientsBlueId,
        },
        image: {
          blueId: imageBlueId,
        },
        price: {
          blueId: priceBlueId,
        },
      };

      const cid = await calculateCidFromObject(processedDish);

      expect(cidFromBlueId).toBe(cid);
    });
  });
});
