import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  Blue,
  BlueIdCalculator,
  type BlueNode,
  type BlueRepository,
} from '@blue-labs/language';
import { repository as blueRepository } from '@blue-repository/types';

import { createDefaultMergingProcessor } from '../../../merge/utils/default.js';
import {
  buildProcessor,
  expectOk,
  numericValue,
  property,
} from '../../test-utils.js';

const PAYNOTE_FIXTURE = new URL('./fixtures/paynote.dev.blue', import.meta.url);

function withRuntimeChannels(sourceYaml: string): string {
  return sourceYaml
    .replace(
      '  payerChannel:\n    type: Core/Channel',
      '  payerChannel:\n    type: Conversation/Timeline Channel\n    timelineId: payer-timeline',
    )
    .replace(
      '  payeeChannel:\n    type: Core/Channel',
      '  payeeChannel:\n    type: Conversation/Timeline Channel\n    timelineId: payee-timeline',
    )
    .replace(
      '  guarantorChannel:\n    type: Core/Channel',
      '  guarantorChannel:\n    type: Conversation/Timeline Channel\n    timelineId: guarantor-timeline',
    );
}

function collectPayNoteAliases(yaml: string): string[] {
  const matches = yaml.match(/PayNote\/[A-Za-z0-9][A-Za-z0-9 /-]*/g) ?? [];
  const unique = new Set<string>();
  for (const match of matches) {
    const alias = match.trim();
    if (alias.length > 0) {
      unique.add(alias);
    }
  }
  return [...unique];
}

function buildFixtureRepository(
  blue: Blue,
  aliases: string[],
): { repository: BlueRepository; aliasBlueIds: Record<string, string> } {
  const aliasBlueIds: Record<string, string> = {};
  const typesMeta: Record<string, unknown> = {};
  const contents: Record<string, unknown> = {};

  for (const alias of aliases) {
    const typeName = alias.replace(/^PayNote\//, '');
    const node = blue.yamlToNode(`name: ${typeName}\n`);
    const blueId = BlueIdCalculator.calculateBlueIdSync(node);
    aliasBlueIds[alias] = blueId;
    typesMeta[blueId] = {
      status: 'stable',
      name: typeName,
      versions: [
        {
          repositoryVersionIndex: 0,
          typeBlueId: blueId,
          attributesAdded: [],
        },
      ],
    };
    contents[blueId] = blue.nodeToJson(node);
  }

  const repository: BlueRepository = {
    name: 'paynote.local.fixture.repo',
    repositoryVersions: ['R0'],
    packages: {
      paynoteFixture: {
        name: 'paynoteFixture',
        aliases: aliasBlueIds,
        typesMeta,
        contents,
        schemas: {},
      },
    },
  };

  return { repository, aliasBlueIds };
}

const publishedAliases = new Set<string>();
for (const pkg of Object.values(blueRepository.packages ?? {})) {
  for (const alias of Object.keys(pkg.aliases ?? {})) {
    publishedAliases.add(alias);
  }
}

function createPayNoteFixture(): {
  blue: Blue;
  document: ReturnType<Blue['yamlToNode']>;
} {
  const sourceYaml = readFileSync(PAYNOTE_FIXTURE, 'utf8');
  const runtimeYaml = withRuntimeChannels(sourceYaml);
  const aliases = collectPayNoteAliases(runtimeYaml);

  const seedBlue = new Blue({
    repositories: [blueRepository],
    mergingProcessor: createDefaultMergingProcessor(),
  });
  const missingAliases = aliases.filter(
    (alias) => !publishedAliases.has(alias),
  );
  const { repository, aliasBlueIds } = buildFixtureRepository(
    seedBlue,
    missingAliases,
  );

  const blue = new Blue({
    repositories: [blueRepository, repository],
    mergingProcessor: createDefaultMergingProcessor(),
  });
  blue.registerBlueIds(aliasBlueIds);

  return {
    blue,
    document: blue.yamlToNode(runtimeYaml),
  };
}

function operationRequestEvent(
  blue: Blue,
  operation: string,
  request?: Record<string, unknown>,
): BlueNode {
  const message: Record<string, unknown> = {
    type: 'Conversation/Operation Request',
    operation,
    request: request ?? {},
  };

  return blue.jsonValueToNode({
    type: 'Conversation/Timeline Entry',
    timeline: { timelineId: 'guarantor-timeline' },
    message,
  });
}

function amountValue(document: BlueNode, field: string): number {
  return numericValue(property(property(document, 'amount'), field));
}

function controlValue(document: BlueNode, field: string): boolean {
  return property(property(document, 'controls'), field).getValue() === true;
}

function transactionDetails(
  blue: Blue,
  document: BlueNode,
): Record<string, unknown> {
  return blue.nodeToJson(
    property(document, 'transactionDetails'),
    'original',
  ) as Record<string, unknown>;
}

interface OperationCase {
  operation: string;
  expectedEventType: string;
  request?: Record<string, unknown>;
  expectedEventSubset?: Record<string, unknown>;
  expectedStatus?: string;
  assertDocument?: (blue: Blue, document: BlueNode) => void;
}

const OPERATION_CASES: OperationCase[] = [
  {
    operation: 'acceptPayNote',
    request: { type: 'PayNote/PayNote Acceptance Requested' },
    expectedEventType: 'PayNote/PayNote Accepted',
    expectedStatus: 'Accepted',
  },
  {
    operation: 'rejectPayNote',
    request: { type: 'PayNote/PayNote Rejected', reason: '' },
    expectedEventType: 'PayNote/PayNote Rejected',
    expectedEventSubset: { reason: '' },
    expectedStatus: 'Rejected',
  },
  {
    operation: 'recordTransactionInitiated',
    request: {
      type: 'PayNote/Transaction Initiated',
      providerReference: 'PROVIDER-123',
    },
    expectedEventType: 'PayNote/Transaction Initiated',
    expectedEventSubset: { providerReference: 'PROVIDER-123' },
    expectedStatus: 'Initiated',
    assertDocument: (blue, document) => {
      const details = transactionDetails(blue, document);
      expect(details.providerReference).toBe('PROVIDER-123');
      expect(details).not.toHaveProperty('type');
    },
  },
  {
    operation: 'recordTransactionInitiationFailed',
    request: {
      type: 'PayNote/Transaction Initiation Failed',
      reason: 'initiation failed',
    },
    expectedEventType: 'PayNote/Transaction Initiation Failed',
    expectedEventSubset: { reason: 'initiation failed' },
    expectedStatus: 'Failed',
  },
  {
    operation: 'confirmPayeeAssignment',
    request: {
      type: 'PayNote/Payee Assignment Confirmed',
      payeeRef: 'customer-42',
    },
    expectedEventType: 'PayNote/Payee Assignment Confirmed',
    expectedEventSubset: { payeeRef: 'customer-42' },
    assertDocument: (blue, document) => {
      const details = transactionDetails(blue, document);
      expect(details.payeeRef).toBe('customer-42');
    },
  },
  {
    operation: 'rejectPayeeAssignment',
    request: {
      type: 'PayNote/Payee Assignment Rejected',
      reason: 'payee rejected',
    },
    expectedEventType: 'PayNote/Payee Assignment Rejected',
    expectedEventSubset: { reason: 'payee rejected' },
  },
  {
    operation: 'confirmTransactionDetailsUpdated',
    request: {
      type: 'PayNote/Transaction Details Updated',
      transactionDetails: { merchantReference: 'MERCHANT-1', customFlag: true },
    },
    expectedEventType: 'PayNote/Transaction Details Updated',
    expectedEventSubset: {
      transactionDetails: { merchantReference: 'MERCHANT-1', customFlag: true },
    },
    assertDocument: (blue, document) => {
      const details = transactionDetails(blue, document);
      expect(details).toMatchObject({
        merchantReference: 'MERCHANT-1',
        customFlag: true,
      });
    },
  },
  {
    operation: 'rejectTransactionDetailsUpdate',
    request: {
      type: 'PayNote/Transaction Details Update Rejected',
      reason: 'details rejected',
    },
    expectedEventType: 'PayNote/Transaction Details Update Rejected',
    expectedEventSubset: { reason: 'details rejected' },
  },
  {
    operation: 'failTransactionDetailsUpdate',
    request: {
      type: 'PayNote/Transaction Details Update Failed',
      reason: 'details failed',
    },
    expectedEventType: 'PayNote/Transaction Details Update Failed',
    expectedEventSubset: { reason: 'details failed' },
  },
  {
    operation: 'secureFunds',
    request: { type: 'PayNote/Funds Secured', amountSecured: 1200 },
    expectedEventType: 'PayNote/Funds Secured',
    expectedEventSubset: { amountSecured: 1200 },
    expectedStatus: 'Secured',
    assertDocument: (_blue, document) => {
      expect(amountValue(document, 'secured')).toBe(1200);
    },
  },
  {
    operation: 'declineSecureFunds',
    request: {
      type: 'PayNote/Funds Securing Declined',
      reason: 'secure declined',
    },
    expectedEventType: 'PayNote/Funds Securing Declined',
    expectedEventSubset: { reason: 'secure declined' },
    expectedStatus: 'Rejected',
  },
  {
    operation: 'failSecureFunds',
    request: { type: 'PayNote/Funds Securing Failed', reason: 'secure failed' },
    expectedEventType: 'PayNote/Funds Securing Failed',
    expectedEventSubset: { reason: 'secure failed' },
    expectedStatus: 'Failed',
  },
  {
    operation: 'completePayment',
    request: { type: 'PayNote/Payment Completed', amountCompleted: 1000 },
    expectedEventType: 'PayNote/Payment Completed',
    expectedEventSubset: { amountCompleted: 1000 },
    expectedStatus: 'Completed',
    assertDocument: (_blue, document) => {
      expect(amountValue(document, 'completed')).toBe(1000);
    },
  },
  {
    operation: 'declineCompletePayment',
    request: {
      type: 'PayNote/Payment Completion Declined',
      reason: 'complete declined',
    },
    expectedEventType: 'PayNote/Payment Completion Declined',
    expectedEventSubset: { reason: 'complete declined' },
    expectedStatus: 'Rejected',
  },
  {
    operation: 'failCompletePayment',
    request: {
      type: 'PayNote/Payment Completion Failed',
      reason: 'complete failed',
    },
    expectedEventType: 'PayNote/Payment Completion Failed',
    expectedEventSubset: { reason: 'complete failed' },
    expectedStatus: 'Failed',
  },
  {
    operation: 'cancelBeforeCompletion',
    request: { type: 'PayNote/Cancel Before Completion Requested', reason: '' },
    expectedEventType: 'PayNote/Payment Cancelled Before Completion',
    expectedStatus: 'Cancelled',
  },
  {
    operation: 'declineCancelBeforeCompletion',
    request: {
      type: 'PayNote/Payment Cancellation Declined',
      reason: 'cancel declined',
    },
    expectedEventType: 'PayNote/Payment Cancellation Declined',
    expectedEventSubset: { reason: 'cancel declined' },
    expectedStatus: 'Rejected',
  },
  {
    operation: 'failCancelBeforeCompletion',
    request: {
      type: 'PayNote/Payment Cancellation Failed',
      reason: 'cancel failed',
    },
    expectedEventType: 'PayNote/Payment Cancellation Failed',
    expectedEventSubset: { reason: 'cancel failed' },
    expectedStatus: 'Failed',
  },
  {
    operation: 'reverseAfterCompletion',
    request: {
      type: 'PayNote/Payment Reversed After Completion',
      amountReversed: 100,
    },
    expectedEventType: 'PayNote/Payment Reversed After Completion',
    expectedEventSubset: { amountReversed: 100 },
    expectedStatus: 'Reversed',
    assertDocument: (_blue, document) => {
      expect(amountValue(document, 'reversed')).toBe(100);
    },
  },
  {
    operation: 'declineReverseAfterCompletion',
    request: {
      type: 'PayNote/Payment Reversal Declined',
      reason: 'reversal declined',
    },
    expectedEventType: 'PayNote/Payment Reversal Declined',
    expectedEventSubset: { reason: 'reversal declined' },
    expectedStatus: 'Rejected',
  },
  {
    operation: 'failReverseAfterCompletion',
    request: {
      type: 'PayNote/Payment Reversal Failed',
      reason: 'reversal failed',
    },
    expectedEventType: 'PayNote/Payment Reversal Failed',
    expectedEventSubset: { reason: 'reversal failed' },
    expectedStatus: 'Failed',
  },
  {
    operation: 'resolveFinalAmount',
    request: { type: 'PayNote/Final Amount Resolved', finalAmount: 1100 },
    expectedEventType: 'PayNote/Final Amount Resolved',
    expectedEventSubset: { finalAmount: 1100 },
    assertDocument: (_blue, document) => {
      expect(amountValue(document, 'finalResolved')).toBe(1100);
    },
  },
  {
    operation: 'rejectFinalAmountResolution',
    request: {
      type: 'PayNote/Final Amount Resolution Rejected',
      reason: 'final amount rejected',
    },
    expectedEventType: 'PayNote/Final Amount Resolution Rejected',
    expectedEventSubset: { reason: 'final amount rejected' },
  },
  {
    operation: 'lockPaymentCompletion',
    request: {
      type: 'PayNote/Payment Completion Locked',
      lockedAt: '2026-01-01T00:00:00Z',
    },
    expectedEventType: 'PayNote/Payment Completion Locked',
    expectedEventSubset: { lockedAt: '2026-01-01T00:00:00Z' },
    assertDocument: (_blue, document) => {
      expect(controlValue(document, 'completionLocked')).toBe(true);
    },
  },
  {
    operation: 'unlockPaymentCompletion',
    request: {
      type: 'PayNote/Payment Completion Unlocked',
      unlockedAt: '2026-01-01T01:00:00Z',
    },
    expectedEventType: 'PayNote/Payment Completion Unlocked',
    expectedEventSubset: { unlockedAt: '2026-01-01T01:00:00Z' },
    assertDocument: (_blue, document) => {
      expect(controlValue(document, 'completionLocked')).toBe(false);
    },
  },
  {
    operation: 'failPaymentCompletionLockChange',
    request: {
      type: 'PayNote/Payment Completion Lock Change Failed',
      reason: 'completion lock failed',
    },
    expectedEventType: 'PayNote/Payment Completion Lock Change Failed',
    expectedEventSubset: { reason: 'completion lock failed' },
  },
  {
    operation: 'lockPaymentReversal',
    request: {
      type: 'PayNote/Payment Reversal Locked',
      lockedAt: '2026-01-01T00:00:00Z',
    },
    expectedEventType: 'PayNote/Payment Reversal Locked',
    expectedEventSubset: { lockedAt: '2026-01-01T00:00:00Z' },
    assertDocument: (_blue, document) => {
      expect(controlValue(document, 'reversalLocked')).toBe(true);
    },
  },
  {
    operation: 'unlockPaymentReversal',
    request: {
      type: 'PayNote/Payment Reversal Unlocked',
      unlockedAt: '2026-01-01T01:00:00Z',
    },
    expectedEventType: 'PayNote/Payment Reversal Unlocked',
    expectedEventSubset: { unlockedAt: '2026-01-01T01:00:00Z' },
    assertDocument: (_blue, document) => {
      expect(controlValue(document, 'reversalLocked')).toBe(false);
    },
  },
  {
    operation: 'failPaymentReversalLockChange',
    request: {
      type: 'PayNote/Payment Reversal Lock Change Failed',
      reason: 'reversal lock failed',
    },
    expectedEventType: 'PayNote/Payment Reversal Lock Change Failed',
    expectedEventSubset: { reason: 'reversal lock failed' },
  },
  {
    operation: 'lockTransactionDetailsUpdate',
    request: {
      type: 'PayNote/Transaction Details Update Locked',
      lockedAt: '2026-01-01T00:00:00Z',
    },
    expectedEventType: 'PayNote/Transaction Details Update Locked',
    expectedEventSubset: { lockedAt: '2026-01-01T00:00:00Z' },
    assertDocument: (_blue, document) => {
      expect(controlValue(document, 'transactionDetailsUpdateLocked')).toBe(
        true,
      );
    },
  },
  {
    operation: 'unlockTransactionDetailsUpdate',
    request: {
      type: 'PayNote/Transaction Details Update Unlocked',
      unlockedAt: '2026-01-01T01:00:00Z',
    },
    expectedEventType: 'PayNote/Transaction Details Update Unlocked',
    expectedEventSubset: { unlockedAt: '2026-01-01T01:00:00Z' },
    assertDocument: (_blue, document) => {
      expect(controlValue(document, 'transactionDetailsUpdateLocked')).toBe(
        false,
      );
    },
  },
  {
    operation: 'failTransactionDetailsUpdateLockChange',
    request: {
      type: 'PayNote/Transaction Details Update Lock Change Failed',
      reason: 'details lock failed',
    },
    expectedEventType: 'PayNote/Transaction Details Update Lock Change Failed',
    expectedEventSubset: { reason: 'details lock failed' },
  },
];

describe('PayNote definition workflows (document fixture)', () => {
  it('initializes runtime state using lifecycle workflow defaults', async () => {
    const { blue, document } = createPayNoteFixture();
    const processor = buildProcessor(blue);

    const initialized = await expectOk(
      processor.initializeDocument(document),
      'PayNote initialization failed',
    );

    expect(property(initialized.document, 'status').getValue()).toBe('Pending');
    expect(amountValue(initialized.document, 'finalResolved')).toBe(0);
    expect(amountValue(initialized.document, 'secured')).toBe(0);
    expect(amountValue(initialized.document, 'completed')).toBe(0);
    expect(amountValue(initialized.document, 'reversed')).toBe(0);

    expect(controlValue(initialized.document, 'completionLocked')).toBe(false);
    expect(controlValue(initialized.document, 'reversalLocked')).toBe(false);
    expect(
      controlValue(initialized.document, 'transactionDetailsUpdateLocked'),
    ).toBe(false);

    expect(transactionDetails(blue, initialized.document)).toEqual({});
  });

  it('runs every guarantor operation and verifies emitted event + state changes', async () => {
    expect(OPERATION_CASES).toHaveLength(32);

    for (const operationCase of OPERATION_CASES) {
      const { blue, document } = createPayNoteFixture();
      const processor = buildProcessor(blue);
      const initialized = await expectOk(
        processor.initializeDocument(document),
        `${operationCase.operation}: initialization failed`,
      );

      const processed = await expectOk(
        processor.processDocument(
          initialized.document.clone(),
          operationRequestEvent(
            blue,
            operationCase.operation,
            operationCase.request,
          ),
        ),
        `${operationCase.operation} failed`,
      );

      expect(property(processed.document, 'status').getValue()).toBe(
        operationCase.expectedStatus ?? 'Pending',
      );

      expect(processed.triggeredEvents).toHaveLength(1);
      const emittedNode = processed.triggeredEvents[0];
      const expectedTypeNode = blue.yamlToNode(
        `type: ${operationCase.expectedEventType}\n`,
      );
      expect(blue.isTypeOfNode(emittedNode, expectedTypeNode)).toBe(true);
      const emitted = blue.nodeToJson(emittedNode, 'original') as Record<
        string,
        unknown
      >;

      if (operationCase.expectedEventSubset) {
        expect(emitted).toMatchObject(operationCase.expectedEventSubset);
      }

      if (operationCase.assertDocument) {
        operationCase.assertDocument(blue, processed.document);
      }
    }
  });

  it('keeps transaction details opaque and treats initiated fields as optional', async () => {
    const { blue, document } = createPayNoteFixture();
    const processor = buildProcessor(blue);

    const initialized = await expectOk(processor.initializeDocument(document));

    const withDetails = await expectOk(
      processor.processDocument(
        initialized.document.clone(),
        operationRequestEvent(blue, 'confirmTransactionDetailsUpdated', {
          type: 'PayNote/Transaction Details Updated',
          transactionDetails: { merchantReference: 'MERCHANT-1' },
        }),
      ),
    );

    const initiated = await expectOk(
      processor.processDocument(
        withDetails.document.clone(),
        operationRequestEvent(blue, 'recordTransactionInitiated', {
          type: 'PayNote/Transaction Initiated',
          providerReference: 'PROVIDER-999',
        }),
      ),
    );

    const details = transactionDetails(blue, initiated.document);
    expect(details).toMatchObject({
      merchantReference: 'MERCHANT-1',
      providerReference: 'PROVIDER-999',
    });
    expect(details).not.toHaveProperty('type');
  });
});
