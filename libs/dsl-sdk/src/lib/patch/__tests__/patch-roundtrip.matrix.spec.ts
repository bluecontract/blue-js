import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import { DocStructure } from '../../structure/doc-structure.js';
import { toOfficialJson } from '../../core/serialization.js';
import {
  applyBlueChangePlan,
  BlueChangeCompiler,
} from '../blue-change-compiler.js';
import { DocPatch } from '../doc-patch.js';

type Mutation = (doc: DocBuilder) => void;

function baseDocument() {
  return DocBuilder.doc()
    .name('Patch Matrix Base')
    .description('Base patch matrix document')
    .field('/counter', 0)
    .field('/status', 'idle')
    .channel('ownerChannel', {
      type: 'Conversation/Timeline Channel',
      timelineId: 'owner-timeline',
    })
    .operation(
      'increment',
      'ownerChannel',
      Number,
      'Increment counter',
      (steps) =>
        steps.replaceExpression(
          'IncrementCounter',
          '/counter',
          "document('/counter') + event.message.request",
        ),
    )
    .buildDocument();
}

const scenarios: ReadonlyArray<{
  readonly name: string;
  readonly mutate: Mutation;
}> = [
  {
    name: 'replaces root counter value',
    mutate: (doc) => {
      doc.field('/counter', 10);
    },
  },
  {
    name: 'adds root metadata field',
    mutate: (doc) => {
      doc.field('/metadata/version', 2);
    },
  },
  {
    name: 'removes root status field',
    mutate: (doc) => {
      doc.remove('/status');
    },
  },
  {
    name: 'renames document',
    mutate: (doc) => {
      doc.name('Patch Matrix Renamed');
    },
  },
  {
    name: 'updates document description',
    mutate: (doc) => {
      doc.description('Updated patch matrix description');
    },
  },
  {
    name: 'adds reviewer channel contract',
    mutate: (doc) => {
      doc.channel('reviewerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'reviewer-timeline',
      });
    },
  },
  {
    name: 'adds audit channel contract',
    mutate: (doc) => {
      doc.channel('auditChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'audit-timeline',
      });
    },
  },
  {
    name: 'updates operation description',
    mutate: (doc) => {
      doc.operation('increment').description('Increment counter v2').done();
    },
  },
  {
    name: 'updates operation request type',
    mutate: (doc) => {
      doc.operation('increment').requestType('Double').done();
    },
  },
  {
    name: 'removes operation implementation contract',
    mutate: (doc) => {
      doc.remove('/contracts/incrementImpl');
    },
  },
  {
    name: 'adds decrement operation contract pair',
    mutate: (doc) => {
      doc.operation(
        'decrement',
        'ownerChannel',
        Number,
        'Decrement counter',
        (steps) =>
          steps.replaceExpression(
            'DecrementCounter',
            '/counter',
            "document('/counter') - event.message.request",
          ),
      );
    },
  },
  {
    name: 'adds initialization workflow',
    mutate: (doc) => {
      doc.onInit('markInitialized', (steps) =>
        steps.replaceValue('SetInitialized', '/initialized', true),
      );
    },
  },
  {
    name: 'adds event workflow',
    mutate: (doc) => {
      doc.onEvent('recordEvent', 'Conversation/Event', (steps) =>
        steps.replaceValue('SetEventSeen', '/eventSeen', true),
      );
    },
  },
  {
    name: 'adds subscription update workflow',
    mutate: (doc) => {
      doc.onSubscriptionUpdate('recordUpdate', 'SUB_PATCH', (steps) =>
        steps.replaceValue('SetUpdateSeen', '/updateSeen', true),
      );
    },
  },
  {
    name: 'adds tracked section and related contracts',
    mutate: (doc) => {
      doc
        .section('patchSection', 'Patch Section', 'Roundtrip section coverage')
        .field('/sectionCounter', 1)
        .channel('sectionChannel', {
          type: 'Conversation/Timeline Channel',
          timelineId: 'section-timeline',
        })
        .endSection();
    },
  },
  {
    name: 'adds composite channel and operation wiring',
    mutate: (doc) => {
      doc
        .channel('allowedChannel', {
          type: 'Conversation/Timeline Channel',
          timelineId: 'allowed-timeline',
        })
        .compositeChannel('participantUnion', 'ownerChannel', 'allowedChannel')
        .operation(
          'compositeOp',
          'participantUnion',
          Number,
          'Composite operation',
          (steps) =>
            steps.replaceExpression(
              'SetCompositeOp',
              '/lastCompositeOp',
              'event.message.operation',
            ),
        );
    },
  },
  {
    name: 'adds contracts policy marker',
    mutate: (doc) => {
      doc.contractsPolicy(true);
    },
  },
  {
    name: 'adds direct change operation pair',
    mutate: (doc) => {
      doc.directChange('changeDocument', 'ownerChannel');
    },
  },
  {
    name: 'adds anchors and links wrappers',
    mutate: (doc) => {
      doc
        .documentAnchors(['anchorA'])
        .sessionLink('primaryLink', 'anchorA', 'TARGET_SESSION');
    },
  },
  {
    name: 'updates nested profile value and adds role field',
    mutate: (doc) => {
      doc
        .field('/profile/name', 'Alice')
        .field('/profile/role', 'admin')
        .field('/profile/name', 'Ada');
    },
  },
];

describe('patch roundtrip matrix', () => {
  // Every matrix scenario validates the full editing loop:
  // base -> mutate -> DocPatch apply -> BlueChangeCompiler apply ->
  // compare official JSON and DocStructure summaries.
  for (const scenario of scenarios) {
    it(`patches and compiles deterministically: ${scenario.name}`, () => {
      const before = baseDocument();
      const afterBuilder = DocBuilder.from(before);
      scenario.mutate(afterBuilder);
      const after = afterBuilder.buildDocument();

      const patch = DocPatch.from(before).mutate((doc) => {
        scenario.mutate(doc);
      });
      const patched = patch.applyTo(before, false);
      expect(toOfficialJson(patched)).toEqual(toOfficialJson(after));

      const changePlan = BlueChangeCompiler.compile(before, after);
      const nestedContractPath = changePlan.patchOperations.some((operation) =>
        /^\/contracts\/[^/]+\/.+/u.test(operation.path),
      );
      expect(nestedContractPath).toBe(false);

      const planned = applyBlueChangePlan(before, changePlan);
      expect(planned).toEqual(toOfficialJson(after));

      expect(DocStructure.from(planned).toSummaryJson()).toEqual(
        DocStructure.from(after).toSummaryJson(),
      );
    });
  }
});
