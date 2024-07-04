import { resolveBlueObjectItems } from '../resolveBlueObjectItems';
import { BlueObject, BlueObjectWithId } from '../../../schema';
import { isBlueObjectResolved } from '../isBlueObjectResolved';

describe('resolveBlueObjectItems - simple', () => {
  // Mock data
  const items = [
    { blueId: 'id1', value: 'Product 1' },
    { blueId: 'id2' },
    { blueId: 'id3' },
  ];

  // Mock resolver function
  const resolveFunction = vi.fn((blueObject: BlueObject) => {
    return Promise.resolve([
      { ...blueObject, value: `Resolved ${blueObject.blueId}` },
    ]);
  });

  beforeEach(() => {
    resolveFunction.mockClear();
  });

  it('should resolve the correct number of items', async () => {
    const result = await resolveBlueObjectItems({
      items,
      count: 2,
      resolveFunction,
    });
    expect(isBlueObjectResolved(result[1])).toBeTruthy();
    expect(result[1].value).toBe('Resolved id2');
  });

  it('should handle no items needing resolving', async () => {
    const allResolvedItems = items.map((item) => ({
      ...item,
      value: `Resolved ${item.blueId}`,
    }));
    const result = await resolveBlueObjectItems({
      items: allResolvedItems,
      count: 2,
      resolveFunction,
    });

    expect(result.every(isBlueObjectResolved)).toBeTruthy();
    expect(resolveFunction).not.toHaveBeenCalled();
  });

  it('should handle recursive resolving', async () => {
    const mixedItems = [
      { blueId: 'id1', value: 'Product 1' },
      { blueId: 'id2' },
      { blueId: 'id3', value: 'Product 3' },
      { blueId: 'id4' },
    ];
    const result = await resolveBlueObjectItems({
      items: mixedItems,
      count: 3,
      resolveFunction,
    });
    expect(result.every(isBlueObjectResolved)).toBeTruthy();
    expect(resolveFunction).toHaveBeenCalledTimes(2);
  });

  it('should throw an error if the resolver function fails', async () => {
    resolveFunction.mockRejectedValue(new Error('Failed to resolve'));
    await expect(
      resolveBlueObjectItems({
        items,
        count: 1,
        resolveFunction,
      })
    ).rejects.toThrow();
  });

  it('should handle boundary conditions', async () => {
    const result = await resolveBlueObjectItems({
      items: [],
      count: 3,
      resolveFunction,
    });
    expect(result).toEqual([]);
  });
});

describe('resolveBlueObjectItems - nested', () => {
  const mocks: Record<string, { blueId: string; value?: string }[]> = {
    h1q1DkEMog85WRk2cdVojYqmUtyK8Z8bxM1ALUucvdHK: [
      { blueId: 'h1q1DkEMog85WRk2cdVojYqmUtyK8Z8bxM1ALUucvdHK' },
      {
        blueId: 'YqmUtyK8Z8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVoj',
        value: 'Product 5',
      },
      { blueId: '8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVojYqmUtyK8Z' },
      {
        blueId: '1DkEMog85M1ALUucvdHKh1qWRk2cdVojYqmUtyK8Z8bx',
        value: 'Product 9',
      },
    ],
    '8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVojYqmUtyK8Z': [
      {
        blueId: 'YqmUtyK8Z8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVoj',
        value: 'Product 6',
      },
      {
        blueId: '8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVojYqmUtyK8Z',
        value: 'Product 7',
      },
      {
        blueId: '1DkEMog85M1ALUucvdHKh1qWRk2cdVojYqmUtyK8Z8bx',
        value: 'Product 8',
      },
    ],
  };

  const items = [
    { blueId: 'h1q1DkEMog85WRk2cdVojYqmUtyK8Z8bxM1ALUucvdHK' },
    {
      blueId: 'jYqmUtyK8Z8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVo',
      value: 'Product 10',
    },
    {
      blueId: 'M1ALUucvdHKh1q1DkEMog85WRk2cdVojYqmUtyK8Z8bx',
      value: 'Product 11',
    },
  ];

  const customResolveFunction = vi.fn(async (blueObject: BlueObjectWithId) => {
    return mocks[blueObject.blueId] || [];
  });

  beforeEach(() => {
    customResolveFunction.mockClear();
  });

  it('should not resolve any items if the count is less than the number of unresolved items', async () => {
    const result = await resolveBlueObjectItems({
      items: [...items],
      count: 2,
      resolveFunction: customResolveFunction,
    });
    expect(result).toEqual(items);
  });

  it('should resolve items when the count includes unresolved items', async () => {
    const result = await resolveBlueObjectItems({
      items: [...items],
      count: 3,
      resolveFunction: customResolveFunction,
    });
    expect(result).toEqual([
      ...mocks['h1q1DkEMog85WRk2cdVojYqmUtyK8Z8bxM1ALUucvdHK'],
      ...items.slice(1),
    ]);
  });

  it('should correctly resolve multiple levels of items when necessary', async () => {
    const result = await resolveBlueObjectItems({
      items: [...items],
      count: 4,
      resolveFunction: customResolveFunction,
    });

    const expected = [
      ...mocks['h1q1DkEMog85WRk2cdVojYqmUtyK8Z8bxM1ALUucvdHK'].slice(0, 2),
      ...mocks['8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVojYqmUtyK8Z'],
      mocks['h1q1DkEMog85WRk2cdVojYqmUtyK8Z8bxM1ALUucvdHK'][3],
      ...items.slice(1),
    ];

    expect(result).toEqual(expected);
  });
});

describe('resolveBlueObjectItems - nested small', () => {
  const mocks: Record<
    string,
    { blueId: string; value?: string }[] | { blueId: string; value?: string }
  > = {
    YqmUtyK8Z8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVoj: {
      blueId: 'YqmUtyK8Z8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVoj',
      value: 'Product 1',
    },
    M1ALUucvdHKh1q1DkEMog85WRk2cdVojYqmUtyK8Z8bx: {
      blueId: 'M1ALUucvdHKh1q1DkEMog85WRk2cdVojYqmUtyK8Z8bx',
      value: 'Product 2',
    },
    tyK8Z8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVojYqmU: [
      { blueId: 'YqmUtyK8Z8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVoj' },
      {
        blueId: 'M1ALUucvdHKh1q1DkEMog85WRk2cdVojYqmUtyK8Z8bx',
      },
    ],
    '1DkEMog85M1ALUucvdHKh1qWRk2cdVojYqmUtyK8Z8bx': {
      blueId: '1DkEMog85M1ALUucvdHKh1qWRk2cdVojYqmUtyK8Z8bx',
      value: 'Product 3',
    },
    '8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVojYqmUtyK8Z': [
      {
        blueId: 'tyK8Z8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVojYqmU',
      },
      {
        blueId: '1DkEMog85M1ALUucvdHKh1qWRk2cdVojYqmUtyK8Z8bx',
      },
    ],
  };

  const items = [{ blueId: '8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVojYqmUtyK8Z' }];

  const customResolveFunction = vi.fn(async (blueObject: BlueObjectWithId) => {
    return mocks[blueObject.blueId] || [];
  });

  beforeEach(() => {
    customResolveFunction.mockClear();
  });

  it('should correctly resolve multiple levels of items when necessary', async () => {
    const result = await resolveBlueObjectItems({
      items: [...items],
      resolveFunction: customResolveFunction,
    });

    const expected = [
      {
        blueId: 'YqmUtyK8Z8bxM1ALUucvdHKh1q1DkEMog85WRk2cdVoj',
        value: 'Product 1',
      },
      {
        blueId: 'M1ALUucvdHKh1q1DkEMog85WRk2cdVojYqmUtyK8Z8bx',
        value: 'Product 2',
      },
      {
        blueId: '1DkEMog85M1ALUucvdHKh1qWRk2cdVojYqmUtyK8Z8bx',
        value: 'Product 3',
      },
    ];

    expect(result).toEqual(expected);
  });
});
