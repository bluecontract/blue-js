import { JsonBlueValue } from '../../../schema';
import { BlueNode } from '../../model/Node';
import { NodeDeserializer } from '../../model/NodeDeserializer';
import { BlueIdCalculator } from '../BlueIdCalculator';

const stringifyForCharacterization = (value: unknown): string => {
  if (
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return `[${value.map(stringifyForCharacterization).join(', ')}]`;
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, entryValue]) =>
          `${key}=${stringifyForCharacterization(entryValue)}`,
      );
    return `{${entries.join(', ')}}`;
  }

  return JSON.stringify(value);
};

const characterizationCalculator = new BlueIdCalculator({
  apply: async (value: JsonBlueValue) =>
    `hash(${stringifyForCharacterization(value)})`,
  applySync: (value: JsonBlueValue) =>
    `hash(${stringifyForCharacterization(value)})`,
});

const calculateNodeBlueId = (value: JsonBlueValue): string => {
  const node = NodeDeserializer.deserialize(value);
  return BlueIdCalculator.calculateBlueIdSync(node);
};

describe('BlueIdCalculator Phase 0 characterization', () => {
  it('documents that empty lists are currently removed during cleaning', () => {
    const withEmptyList = calculateNodeBlueId({ value: 1, children: [] });
    const withoutEmptyList = calculateNodeBlueId({ value: 1 });

    expect(withEmptyList).toBe(withoutEmptyList);
  });

  it('documents that any map with blueId currently short-circuits', () => {
    const blueId = 'ExistingBlueId';

    expect(
      characterizationCalculator.calculateSync({
        blueId,
        value: 'additional content',
      }),
    ).toBe(blueId);
  });

  it('documents that list hashing currently starts from the first element', () => {
    const result = characterizationCalculator.calculateSync(['a', 'b']);

    expect(result).toBe('hash([{blueId=hash(a)}, {blueId=hash(b)}])');
    expect(result).not.toContain('$list');
  });

  it('documents that low-level JSON calculation currently lacks wrapper parity', () => {
    const authoringSugar = characterizationCalculator.calculateSync({ x: 1 });
    const wrapped = characterizationCalculator.calculateSync({
      x: { value: 1 },
    });

    expect(authoringSugar).toBe('hash({x={blueId=hash(1)}})');
    expect(wrapped).toBe('hash({x={blueId=hash({value=1})}})');
    expect(authoringSugar).not.toBe(wrapped);
  });

  it('keeps the existing public snapshot for a representative node', () => {
    const node = new BlueNode('phase0').setValue('baseline').setProperties({
      nested: new BlueNode().setValue(42),
    });

    expect(BlueIdCalculator.calculateBlueIdSync(node)).toMatchInlineSnapshot(
      `"8rKrtigKUWJs2xpc61EtymW188L26agAP4cFSJx8GAha"`,
    );
  });

  it.todo('preserves empty lists as distinct from absent fields in Phase A');
  it.todo('short-circuits only exact { blueId } references in Phase A');
  it.todo('hashes lists from the specification empty-list seed in Phase A');
  it.todo('normalizes authoring sugar to wrapped canonical form in Phase A');
});
