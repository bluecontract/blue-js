/**
 * Java reference:
 * - references/java-sdk/src/main/java/blue/language/sdk/internal/ChangesetBuilder.java
 */
import { ChangesetBuilder } from '../internal/changeset-builder.js';

describe('ChangesetBuilder', () => {
  it('builds replace, add, and remove entries', () => {
    const changeset = new ChangesetBuilder()
      .replaceValue('/counter', 2)
      .replaceExpression('/expr', "document('/counter') + 1")
      .addValue('/items/0', 'x')
      .remove('/obsolete')
      .build();

    expect(changeset).toHaveLength(4);
    expect(changeset[0].getProperties()?.op?.getValue()).toBe('replace');
    expect(changeset[1].getProperties()?.val?.getValue()).toBe(
      "${document('/counter') + 1}",
    );
    expect(changeset[2].getProperties()?.op?.getValue()).toBe('add');
    expect(changeset[3].getProperties()?.op?.getValue()).toBe('remove');
  });

  it('rejects blank patch paths', () => {
    expect(() => new ChangesetBuilder().replaceValue(' ', 1)).toThrow(
      'Patch path cannot be empty.',
    );
  });

  it('rejects reserved processor-relative paths', () => {
    expect(() =>
      new ChangesetBuilder().replaceValue('/contracts/checkpoint', 1),
    ).toThrow(
      'Mutating reserved processor contract path is forbidden: /contracts/checkpoint',
    );
  });
});
