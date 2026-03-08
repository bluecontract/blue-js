/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/patch/ChangeRequestCompilerTest.java
*/

import { BlueChangeCompiler, DocBuilder } from '../lib';
import { putDocumentSection } from './editing-support';

describe('BlueChangeCompiler', () => {
  it('separates root-field changes from contract changes', () => {
    const before = DocBuilder.doc()
      .name('Counter')
      .field('/counter', 0)
      .channel('ownerChannel')
      .operation('increment')
      .channel('ownerChannel')
      .description('Increment')
      .steps((steps) => steps.replaceValue('Set', '/counter', 1))
      .done()
      .buildDocument();
    const after = DocBuilder.from(before.clone())
      .replace('/counter', 10)
      .operation('decrement')
      .channel('ownerChannel')
      .description('Decrement')
      .steps((steps) =>
        steps.replaceExpression(
          'ApplyDecrement',
          '/counter',
          "document('/counter') - 1",
        ),
      )
      .done()
      .buildDocument();

    const plan = BlueChangeCompiler.compile(before, after);

    expect(plan.rootChanges.map((change) => change.path)).toEqual(['/counter']);
    expect(plan.contractAdds.map((change) => change.key)).toEqual([
      'decrement',
      'decrementImpl',
    ]);
    expect(plan.contractReplacements).toEqual([]);
    expect(plan.contractRemovals).toEqual([]);
  });

  it('treats contract changes as atomic units', () => {
    const before = DocBuilder.doc()
      .name('Counter')
      .field('/counter', 0)
      .channel('ownerChannel')
      .operation('increment')
      .channel('ownerChannel')
      .description('Increment')
      .requestType('Integer')
      .steps((steps) =>
        steps.replaceExpression(
          'Apply',
          '/counter',
          "document('/counter') + event.message.request",
        ),
      )
      .done()
      .buildDocument();
    const after = DocBuilder.from(before.clone())
      .replace(
        '/contracts/incrementImpl/steps/0/changeset/0/val',
        DocBuilder.expr("document('/counter') + (event.message.request * 2)"),
      )
      .buildDocument();

    const plan = BlueChangeCompiler.compile(before, after);

    expect(plan.rootChanges).toEqual([]);
    expect(plan.contractReplacements.map((change) => change.key)).toEqual([
      'incrementImpl',
    ]);
    expect(
      plan.contractReplacements[0]?.contract &&
        typeof plan.contractReplacements[0].contract === 'object',
    ).toBe(true);
  });

  it('preserves known section membership when changing grouped contracts', () => {
    const before = DocBuilder.doc()
      .name('Counter')
      .field('/counter', 0)
      .channel('ownerChannel')
      .operation('increment')
      .channel('ownerChannel')
      .description('Increment')
      .steps((steps) => steps.replaceValue('Set', '/counter', 1))
      .done()
      .buildDocument();

    putDocumentSection(before, {
      key: 'counterOps',
      title: 'Counter operations',
      relatedFields: ['/counter'],
      relatedContracts: ['increment', 'incrementImpl'],
    });

    const after = DocBuilder.from(before.clone())
      .replace('/contracts/increment/description', 'Increment twice')
      .buildDocument();

    const plan = BlueChangeCompiler.compile(before, after);

    expect(plan.contractReplacements.map((change) => change.key)).toEqual([
      'increment',
    ]);
    expect(plan.contractReplacements[0]?.sectionKey).toBe('counterOps');
    expect(plan.groups.map((group) => group.key)).toEqual([
      'section:counterOps',
    ]);
  });

  it('assigns fallback buckets deterministically for unsectioned contracts', () => {
    const before = DocBuilder.doc().name('Buckets').buildDocument();
    const after = DocBuilder.doc()
      .name('Buckets')
      .channel('reviewerChannel')
      .ai('assistant')
      .sessionId('session-1')
      .permissionFrom('reviewerChannel')
      .done()
      .buildDocument();

    const plan = BlueChangeCompiler.compile(before, after);
    const bucketByKey = Object.fromEntries(
      [...plan.contractAdds, ...plan.contractReplacements].map((change) => [
        change.key,
        change.bucket,
      ]),
    );

    expect(bucketByKey.reviewerChannel).toBe('participants');
    expect(Object.values(bucketByKey)).toContain('ai');
  });

  it('produces deterministic summaries and prompt text', () => {
    const before = DocBuilder.doc()
      .name('Doc')
      .field('/counter', 1)
      .buildDocument();
    const after = DocBuilder.from(before.clone())
      .field('/status', 'ready')
      .buildDocument();

    const first = BlueChangeCompiler.compile(before, after);
    const second = BlueChangeCompiler.compile(before.clone(), after.clone());

    expect(first.toSummaryJson()).toEqual(second.toSummaryJson());
    expect(first.toPromptText()).toEqual(second.toPromptText());
  });
});
