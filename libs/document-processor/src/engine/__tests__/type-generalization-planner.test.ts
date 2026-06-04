import { Blue, BlueNode } from '@blue-labs/language';
import { describe, expect, it } from 'vitest';

import {
  blueRepository,
  blueIds,
} from '../../repository/semantic-repository.js';
import type { JsonPatch } from '../../model/shared/json-patch.js';
import { PatchEngine } from '../../runtime/patch-engine.js';
import { ProcessorFatalError } from '../processor-fatal-error.js';
import {
  nodeAt,
  TypeGeneralizationPlanner,
} from '../generalization/type-generalization-planner.js';
import {
  StaticTypeGraphProvider,
  type TypeDescriptor,
} from '../generalization/type-graph-provider.js';
import { createDefaultMergingProcessor } from '../../merge/utils/default.js';
import { ProcessorErrorCategory } from '../../types/document-processing-result.js';

const PRICE = '4AQJxurDsYFiwbuh6TshyzZ1XJgyRDQSoFHeCu2Kcw8p';
const PRICE_EUR = 'GKR2zJxmhCkDjabCgsVVfv4nsFYYDmk8XaGGqdNrtZKd';
const PRODUCT = '4kaXvNM9BLxbTQrJYPByzTwmD7z6Lsrm7jYfstjsHFhu';
const PRODUCT_EUR = 'FS9ZLvKJaqp5hzs5XpmCyMvm8zTtYvfsVWVUApZ7fpn7';
const PRODUCT_EUR_RELAXED = '9JkigwfYDrWWjA8a1bErK49e6iZEzFjArWt6cPa9rnYp';
const ORDER = '8rv4ZHTxnfbJcWnuh4iVABcJSsdfJ33DkCz4CrAQN5DW';
const ORDER_EUR = 'D7f6pLdJSZYoerXVSkBmcqxP6J9hpJcwcLqS3c1wFdEr';
const CATALOG = 'HytynwWoLWCKtN9XUrMg66b18aawusGVcN7a9qDaAz5K';
const CATALOG_EUR = 'HmekYTeotxUgGZBH49UQfsqgKJqPdsUN2nQMUNHyh39G';
const PAYNOTE = 'GuYxgHX6eCjvgoXnvrJKFmpPbVGJ3GSBLfDdhArqpspe';
const BANK_TRANSFER = 'GeDgB3LzDSRhNJH6PD5wwZAVtVDfCZhqXxWzEY3ctWHF';
const EU_BANK_TRANSFER = '95ykwi5Gh48Pp5GJzEAhkjgjnH8fFs8jWiXi3ccWDTWq';

const blue = new Blue({
  repositories: [blueRepository],
  mergingProcessor: createDefaultMergingProcessor(),
});

describe('production type generalization planner', () => {
  it('productionGeneralizationNearestValidChildType', () => {
    const document = object({
      price: typed(PRICE_EUR, { amount: scalar(150), currency: scalar('EUR') }),
    });

    const generated = plan(document, {
      op: 'REPLACE',
      path: '/price/currency',
      val: scalar('USD'),
    });

    expect(generated.map((patch) => patch.path)).toEqual(['/price/type']);
    const result = applyAll(
      document,
      {
        op: 'REPLACE',
        path: '/price/currency',
        val: scalar('USD'),
      },
      generated,
    );
    expect(nodeAt(result, '/price/type')?.getBlueId()).toBe(PRICE);
  });

  it('productionGeneralizationPropagatesToParentType', () => {
    const document = typed(PRODUCT_EUR, {
      price: typed(PRICE_EUR, { currency: scalar('EUR') }),
    });

    const generated = plan(document, {
      op: 'REPLACE',
      path: '/price/currency',
      val: scalar('USD'),
    });

    expect(generated.map((patch) => patch.path)).toEqual([
      '/price/type',
      '/type',
    ]);
  });

  it('productionGeneralizationDoesNotGeneralizeRootWhenRootStillConforms', () => {
    const document = typed(PRODUCT_EUR_RELAXED, {
      price: typed(PRICE_EUR, { currency: scalar('EUR') }),
    });

    const generated = plan(document, {
      op: 'REPLACE',
      path: '/price/currency',
      val: scalar('USD'),
    });

    expect(generated.map((patch) => patch.path)).toEqual(['/price/type']);
  });

  it('productionGeneralizationGeneralizesRootOnlyWhenChildTypeBreaksRootInvariant', () => {
    const document = typed(PRODUCT_EUR, {
      price: typed(PRICE_EUR, { currency: scalar('EUR') }),
    });

    const generated = plan(document, {
      op: 'REPLACE',
      path: '/price/currency',
      val: scalar('USD'),
    });

    expect(generated.map((patch) => patch.path)).toEqual([
      '/price/type',
      '/type',
    ]);
  });

  it('productionGeneralizationWalksMultipleInvalidAncestors', () => {
    const document = typed(CATALOG_EUR, {
      order: typed(ORDER_EUR, {
        product: typed(PRODUCT_EUR, {
          price: typed(PRICE_EUR, { currency: scalar('EUR') }),
        }),
      }),
    });

    const generated = plan(document, {
      op: 'REPLACE',
      path: '/order/product/price/currency',
      val: scalar('USD'),
    });

    expect(generated.map((patch) => patch.path)).toEqual([
      '/order/product/price/type',
      '/order/product/type',
      '/order/type',
      '/type',
    ]);
  });

  it('productionGeneralizationLeavesUnrelatedAncestorsUntouched', () => {
    const document = typed(ORDER, {
      product: typed(PRODUCT_EUR_RELAXED, {
        price: typed(PRICE_EUR, { currency: scalar('EUR') }),
      }),
      audit: typed(PRICE_EUR, { currency: scalar('EUR') }),
    });

    const generated = plan(document, {
      op: 'REPLACE',
      path: '/product/price/currency',
      val: scalar('USD'),
    });

    expect(generated.map((patch) => patch.path)).toEqual([
      '/product/price/type',
    ]);
  });

  it('productionGeneralizationPolicyRejectModeFailsWithoutFixtureRuntime', () => {
    const document = object({
      price: typed(PRICE_EUR, { currency: scalar('EUR') }),
      contracts: object({
        generalization: typed(blueIds['Type Generalization Policy'], {
          rules: list([
            object({
              path: scalar('/price'),
              mode: scalar('reject'),
            }),
          ]),
        }),
      }),
    });

    expect(() =>
      plan(document, {
        op: 'REPLACE',
        path: '/price/currency',
        val: scalar('USD'),
      }),
    ).toThrow(ProcessorFatalError);
  });

  it('productionGeneralizationPolicyFloorAllowsEqualGeneratedType', () => {
    const document = object({
      price: typed(PRICE_EUR, { currency: scalar('EUR') }),
      contracts: object({
        generalization: typed(blueIds['Type Generalization Policy'], {
          rules: list([
            object({
              path: scalar('/price'),
              mode: scalar('nearest-valid'),
              mustRemainSubtypeOf: new BlueNode().setBlueId(PRICE),
            }),
          ]),
        }),
      }),
    });

    expect(
      plan(document, {
        op: 'REPLACE',
        path: '/price/currency',
        val: scalar('USD'),
      }).map((patch) => patch.path),
    ).toEqual(['/price/type']);
  });

  it('productionGeneralizationPolicyFloorRejectsOvergeneralization', () => {
    const document = typed(EU_BANK_TRANSFER, {
      paymentKind: scalar('bank-transfer'),
      rail: scalar('SEPA'),
      contracts: object({
        generalization: typed(blueIds['Type Generalization Policy'], {
          rules: list([
            object({
              path: scalar('/'),
              mode: scalar('nearest-valid'),
              mustRemainSubtypeOf: new BlueNode().setBlueId(BANK_TRANSFER),
            }),
          ]),
        }),
      }),
    });

    expectFatal(
      () =>
        plan(document, {
          op: 'REPLACE',
          path: '/paymentKind',
          val: scalar('card'),
        }),
      ProcessorErrorCategory.GeneralizationRejected,
    );
  });

  it('productionGeneralizationPolicyUsesScopeLocalMarker', () => {
    const document = object({
      child: object({
        price: typed(PRICE_EUR, { currency: scalar('EUR') }),
        contracts: object({
          generalization: typed(blueIds['Type Generalization Policy'], {
            rules: list([
              object({
                path: scalar('/price'),
                mode: scalar('reject'),
              }),
            ]),
          }),
        }),
      }),
    });

    expectFatal(
      () =>
        plan(
          document,
          {
            op: 'REPLACE',
            path: '/child/price/currency',
            val: scalar('USD'),
          },
          '/child',
        ),
      ProcessorErrorCategory.GeneralizationRejected,
    );
  });

  it('productionGeneralizationPolicyRulePathIsScopeRelative', () => {
    const document = object({
      child: object({
        price: typed(PRICE_EUR, { currency: scalar('EUR') }),
      }),
      contracts: object({
        generalization: typed(blueIds['Type Generalization Policy'], {
          rules: list([
            object({
              path: scalar('/price'),
              mode: scalar('reject'),
            }),
          ]),
        }),
      }),
    });

    expect(
      plan(
        document,
        {
          op: 'REPLACE',
          path: '/child/price/currency',
          val: scalar('USD'),
        },
        '/child',
      ).map((patch) => patch.path),
    ).toEqual(['/child/price/type']);
  });

  it('embeddedChildPatchCannotGeneralizeParentScope', () => {
    const document = typed(ORDER_EUR, {
      contracts: object({
        embedded: typed(blueIds['Embedded Node Channel'], {
          paths: list([scalar('/product')]),
        }),
      }),
      product: typed(PRODUCT_EUR, {
        price: typed(PRICE_EUR, { currency: scalar('EUR') }),
      }),
    });

    expectFatal(
      () =>
        plan(
          document,
          {
            op: 'REPLACE',
            path: '/product/price/currency',
            val: scalar('USD'),
          },
          '/product',
        ),
      ProcessorErrorCategory.BoundaryViolation,
    );
  });
});

function expectFatal(
  fn: () => unknown,
  category: ProcessorErrorCategory,
): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ProcessorFatalError);
    expect((error as ProcessorFatalError).category).toBe(category);
    return;
  }
  throw new Error(`Expected ProcessorFatalError with category ${category}`);
}

function plan(
  document: BlueNode,
  patch: JsonPatch,
  scopePath = '/',
): readonly JsonPatch[] {
  return new TypeGeneralizationPlanner(typeGraph()).planPatch(
    scopePath,
    document,
    patch,
  ).generatedPatches;
}

function typeGraph(): StaticTypeGraphProvider {
  return new StaticTypeGraphProvider(
    [
      descriptor(PRICE),
      descriptor(PRICE_EUR, {
        parent: PRICE,
        fixedValues: { '/currency': scalar('EUR') },
      }),
      descriptor(PRODUCT, {
        fieldTypes: { '/price': PRICE },
      }),
      descriptor(PRODUCT_EUR, {
        parent: PRODUCT,
        fieldTypes: { '/price': PRICE_EUR },
      }),
      descriptor(PRODUCT_EUR_RELAXED, {
        parent: PRODUCT,
      }),
      descriptor(ORDER, {
        fieldTypes: { '/product': PRODUCT },
      }),
      descriptor(ORDER_EUR, {
        parent: ORDER,
        fieldTypes: { '/product': PRODUCT_EUR },
      }),
      descriptor(CATALOG, {
        fieldTypes: { '/order': ORDER },
      }),
      descriptor(CATALOG_EUR, {
        parent: CATALOG,
        fieldTypes: { '/order': ORDER_EUR },
      }),
      descriptor(PAYNOTE),
      descriptor(BANK_TRANSFER, {
        parent: PAYNOTE,
        fixedValues: { '/paymentKind': scalar('bank-transfer') },
      }),
      descriptor(EU_BANK_TRANSFER, {
        parent: BANK_TRANSFER,
        fixedValues: { '/rail': scalar('SEPA') },
      }),
    ],
    blue,
    nodeAt,
  );
}

function descriptor(
  blueId: string,
  spec: {
    readonly parent?: string;
    readonly fixedValues?: Record<string, BlueNode>;
    readonly fieldTypes?: Record<string, string>;
  } = {},
): TypeDescriptor {
  return {
    blueId,
    parentBlueId: spec.parent ?? null,
    fixedValues: new Map(Object.entries(spec.fixedValues ?? {})),
    fieldTypes: new Map(Object.entries(spec.fieldTypes ?? {})),
  };
}

function applyAll(
  document: BlueNode,
  patch: JsonPatch,
  generatedPatches: readonly JsonPatch[],
): BlueNode {
  const copy = document.clone();
  const engine = new PatchEngine(copy);
  engine.applyPatch('/', patch);
  for (const generatedPatch of generatedPatches) {
    engine.applyPatch('/', generatedPatch);
  }
  return copy;
}

function typed(
  typeBlueId: string,
  properties: Record<string, BlueNode>,
): BlueNode {
  return object(properties).setType(new BlueNode().setBlueId(typeBlueId));
}

function object(properties: Record<string, BlueNode>): BlueNode {
  return new BlueNode().setProperties(properties);
}

function list(items: BlueNode[]): BlueNode {
  return new BlueNode().setItems(items);
}

function scalar(value: string | number | boolean): BlueNode {
  return new BlueNode().setValue(value);
}
