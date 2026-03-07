/*
Java references:
- references/java-sdk/src/main/java/blue/language/sdk/internal/ChangesetBuilder.java
*/

import { ChangesetBuilder } from '../lib/internal/changeset-builder';

describe('ChangesetBuilder guardrails', () => {
  it('rejects blank patch paths', () => {
    const changeset = new ChangesetBuilder();

    expect(() => changeset.replaceValue(' ', 1)).toThrowError(
      'Patch path cannot be empty',
    );
    expect(() => changeset.remove('')).toThrowError(
      'Patch path cannot be empty',
    );
  });

  it('rejects reserved processor-managed contract paths', () => {
    const changeset = new ChangesetBuilder();

    expect(() =>
      changeset.replaceValue('/contracts/checkpoint', 1),
    ).toThrowError(/reserved processor contract path/);
    expect(() =>
      changeset.replaceExpression(
        '/contracts/initialized/documentId',
        "document('/id')",
      ),
    ).toThrowError(/reserved processor contract path/);
    expect(() =>
      changeset.addValue('/contracts/embedded/x', true),
    ).toThrowError(/reserved processor contract path/);
    expect(() => changeset.remove('/contracts/terminated')).toThrowError(
      /reserved processor contract path/,
    );
  });
});
