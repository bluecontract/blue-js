import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import { toOfficialJson } from '../../core/serialization.js';
import {
  applyBlueChangePlan,
  BlueChangeCompiler,
  compileContractChanges,
  compileRootChanges,
} from '../blue-change-compiler.js';

describe('BlueChangeCompiler', () => {
  it('compiles root changes without touching contracts', () => {
    const before = DocBuilder.doc()
      .name('Root Change Compiler')
      .field('/counter', 0)
      .field('/status', 'idle')
      .contractsPolicy(true)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .buildDocument();

    const after = DocBuilder.from(before)
      .field('/counter', 5)
      .field('/status', 'ready')
      .buildDocument();

    expect(compileRootChanges(before, after)).toEqual([
      {
        op: 'replace',
        path: '/counter',
        val: 5,
      },
      {
        op: 'replace',
        path: '/status',
        val: 'ready',
      },
    ]);
  });

  it('preserves root policy add/remove/replace operations in patch plans', () => {
    const before = {
      name: 'Root Policies',
      policies: {
        changeGuard: {
          type: 'Conversation/Contracts Change Policy',
          requireSectionChanges: true,
        },
        legacyGuard: {
          type: 'Conversation/Contracts Change Policy',
          requireSectionChanges: false,
        },
      },
    };
    const after = {
      name: 'Root Policies',
      policies: {
        changeGuard: {
          type: 'Conversation/Contracts Change Policy',
          requireSectionChanges: false,
        },
        releaseGuard: {
          type: 'Conversation/Contracts Change Policy',
          requireSectionChanges: true,
        },
      },
    };

    const plan = BlueChangeCompiler.compile(before, after);

    expect(
      plan.patchOperations.map(
        (operation) => `${operation.op}:${operation.path}`,
      ),
    ).toEqual([
      'remove:/policies/legacyGuard',
      'replace:/policies/changeGuard/requireSectionChanges',
      'add:/policies/releaseGuard',
    ]);
    expect(applyBlueChangePlan(before, plan)).toEqual(after);
  });

  it('compiles contract changes as whole-node add/replace/remove operations', () => {
    const before = DocBuilder.doc()
      .name('Contract Change Compiler')
      .section('participants', 'Participants')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .endSection()
      .section('logic', 'Logic')
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
      .endSection()
      .buildDocument();

    const after = DocBuilder.from(before)
      .channel('reviewerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'reviewer-timeline',
      })
      .operation('increment')
      .description('Increment counter (v2)')
      .done()
      .remove('/contracts/incrementImpl')
      .buildDocument();

    const changes = compileContractChanges(before, after);
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'add',
          contractKey: 'reviewerChannel',
        }),
        expect.objectContaining({
          op: 'replace',
          contractKey: 'increment',
          sectionKey: 'logic',
        }),
        expect.objectContaining({
          op: 'remove',
          contractKey: 'incrementImpl',
        }),
      ]),
    );
    const incrementChange = changes.find(
      (change) => change.contractKey === 'increment',
    );
    expect(incrementChange?.after).toEqual(
      expect.objectContaining({
        description: 'Increment counter (v2)',
      }),
    );
  });

  it('produces deterministic patch plans and applies them to match rebuilt document', () => {
    const before = DocBuilder.doc()
      .name('Patch Plan Source')
      .field('/counter', 0)
      .field('/status', 'idle')
      .section('participants', 'Participants')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .endSection()
      .section('logic', 'Logic')
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
      .endSection()
      .buildDocument();

    const after = DocBuilder.from(before)
      .field('/counter', 8)
      .field('/status', 'ready')
      .operation('increment')
      .description('Increment counter v2')
      .done()
      .channel('auditChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'audit-timeline',
      })
      .buildDocument();

    const plan = BlueChangeCompiler.compile(before, after);
    expect(plan.rootChanges).toEqual([
      { op: 'replace', path: '/counter', val: 8 },
      { op: 'replace', path: '/status', val: 'ready' },
    ]);
    expect(
      plan.patchOperations.map(
        (operation) => `${operation.op}:${operation.path}`,
      ),
    ).toEqual([
      'replace:/counter',
      'replace:/status',
      'add:/contracts/auditChannel',
      'replace:/contracts/increment',
    ]);

    const applied = applyBlueChangePlan(before, plan);
    expect(applied).toEqual(toOfficialJson(after));
  });

  it('escapes contract keys in compiled patch operations', () => {
    const before = {
      name: 'Escaped Contract Keys',
      contracts: {
        'obsolete/channel~v0': {
          type: 'Conversation/Timeline Channel',
          timelineId: 'obsolete-timeline',
        },
        'ops/channel~v1': {
          type: 'Conversation/Timeline Channel',
          timelineId: 'ops-before',
        },
      },
    };
    const after = {
      name: 'Escaped Contract Keys',
      contracts: {
        'notify/channel~v2': {
          type: 'Conversation/Timeline Channel',
          timelineId: 'notify-timeline',
        },
        'ops/channel~v1': {
          type: 'Conversation/Timeline Channel',
          timelineId: 'ops-after',
        },
      },
    };

    const plan = BlueChangeCompiler.compile(before, after);

    expect(
      plan.patchOperations.map(
        (operation) => `${operation.op}:${operation.path}`,
      ),
    ).toEqual([
      'remove:/contracts/obsolete~1channel~0v0',
      'add:/contracts/notify~1channel~0v2',
      'replace:/contracts/ops~1channel~0v1',
    ]);
    expect(applyBlueChangePlan(before, plan)).toEqual(after);
  });

  it('removes the contracts root when the target document omits it entirely', () => {
    const before = {
      name: 'Drop Contracts Root',
      contracts: {
        ownerChannel: {
          type: 'Conversation/Timeline Channel',
          timelineId: 'owner-timeline',
        },
      },
    };
    const after = {
      name: 'Drop Contracts Root',
    };

    const plan = BlueChangeCompiler.compile(before, after);

    expect(
      plan.patchOperations.map(
        (operation) => `${operation.op}:${operation.path}`,
      ),
    ).toEqual(['remove:/contracts/ownerChannel', 'remove:/contracts']);
    expect(applyBlueChangePlan(before, plan)).toEqual(after);
  });

  it('removes an empty contracts root when the target omits contracts', () => {
    const before = {
      name: 'Drop Empty Contracts Root',
      contracts: {},
    };
    const after = {
      name: 'Drop Empty Contracts Root',
    };

    const plan = BlueChangeCompiler.compile(before, after);

    expect(plan.patchOperations).toEqual([
      {
        op: 'remove',
        path: '/contracts',
      },
    ]);
    expect(applyBlueChangePlan(before, plan)).toEqual(after);
  });
});
