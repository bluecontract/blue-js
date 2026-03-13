import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import { toOfficialJson } from '../../core/serialization.js';
import { assertCanonicalNodeEquals } from '../../../test-support/editing-support.js';
import {
  applyBlueChangePlan,
  BlueChangeCompiler,
} from '../blue-change-compiler.js';
import { DocPatch } from '../doc-patch.js';
import { DocStructure } from '../../structure/doc-structure.js';

describe('editing pipeline public surface', () => {
  it('roundtrips root and contract changes through DocPatch and BlueChangeCompiler', () => {
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
          'ApplyIncrement',
          '/counter',
          "document('/counter') + event.message.request",
        ),
      )
      .done()
      .buildDocument();
    const after = DocBuilder.from(before.clone())
      .field('/status', 'ready')
      .operation('decrement')
      .channel('ownerChannel')
      .description('Decrement')
      .requestType('Integer')
      .steps((steps) =>
        steps.replaceExpression(
          'ApplyDecrement',
          '/counter',
          "document('/counter') - event.message.request",
        ),
      )
      .done()
      .buildDocument();

    const patch = DocPatch.from(before).diff(after);
    const applied = patch.apply();
    const plan = BlueChangeCompiler.compile(before, after);

    assertCanonicalNodeEquals(applied, after);
    expect(patch.toTargetJson()).toEqual(toOfficialJson(after));
    expect(applyBlueChangePlan(before, plan)).toEqual(toOfficialJson(after));
    expect(DocStructure.from(applied).toSummaryJson()).toEqual(
      DocStructure.from(after).toSummaryJson(),
    );
    expect(plan.contractAdds.map((change) => change.contractKey)).toEqual([
      'decrement',
      'decrementImpl',
    ]);
    expect(plan.toSummaryJson()).toEqual(
      BlueChangeCompiler.compile(before.clone(), after.clone()).toSummaryJson(),
    );
    expect(plan.toPromptText()).toContain('Contract adds: 2');
  });

  it('preserves reserved-looking payload keys in root fields and contracts', () => {
    const before = DocBuilder.doc()
      .name('Reserved payloads')
      .field('/payload', {
        $sdkDslEnvelope: 'root-marker-before',
        $sdkDslNode: 'root-before',
        $sdkDslItems: ['a', 'b'],
      })
      .channel('ownerChannel')
      .operation('submit')
      .channel('ownerChannel')
      .description('Submit payload')
      .noRequest()
      .steps((steps) =>
        steps.emit('EmitPayload', {
          type: 'Conversation/Event',
          payload: {
            $sdkDslEnvelope: 'contract-marker-before',
            $sdkDslNode: 'contract-before',
            $sdkDslItems: ['x', 'y'],
          },
        }),
      )
      .done()
      .buildDocument();
    const after = DocBuilder.doc()
      .name('Reserved payloads')
      .field('/payload', {
        $sdkDslEnvelope: 'root-marker-after',
        $sdkDslNode: 'root-after',
        $sdkDslItems: ['c', 'd'],
      })
      .channel('ownerChannel')
      .operation('submit')
      .channel('ownerChannel')
      .description('Submit payload')
      .noRequest()
      .steps((steps) =>
        steps.emit('EmitPayload', {
          type: 'Conversation/Event',
          payload: {
            $sdkDslEnvelope: 'contract-marker-after',
            $sdkDslNode: 'contract-after',
            $sdkDslItems: ['z'],
          },
        }),
      )
      .done()
      .buildDocument();

    assertCanonicalNodeEquals(DocPatch.from(before).diff(after).apply(), after);
    expect(
      applyBlueChangePlan(before, BlueChangeCompiler.compile(before, after)),
    ).toEqual(toOfficialJson(after));
  });
});
