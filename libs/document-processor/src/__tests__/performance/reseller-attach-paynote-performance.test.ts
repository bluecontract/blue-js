import { performance } from 'node:perf_hooks';

import { describe, expect, it } from 'vitest';
import { Blue, BlueNode } from '@blue-labs/language';

import {
  DocumentProcessor,
  type DocumentProcessorOptions,
} from '../../api/document-processor.js';
import { ProcessorEngine } from '../../engine/processor-engine.js';
import type { ProcessorTimingSink } from '../../engine/processor-timing.js';
import { myosBlueIds } from '../../repository/semantic-repository.js';
import { createBlue } from '../../test-support/blue.js';
import { ProcessorStatus } from '../../types/document-processing-result.js';

type TimingSpan = {
  readonly name: string;
  readonly durationMs: number;
  readonly meta?: Readonly<Record<string, unknown>>;
};

type JsonRecord = Record<string, unknown>;

const DEFAULT_BUDGET_MS = 5_000;
const STRICT_BUDGET_MS = 2_000;

describe('reseller attachPayNote performance', () => {
  it('attaches a package PayNote snapshot without pathological processor cost', async () => {
    const blue = createBlue();
    const payNoteSnapshot = buildMinimizedPayNoteSnapshot(blue);
    const document = await initializedProcessorDocument(blue);
    const event = operationRequestEvent(blue, payNoteSnapshot);
    const runs = {
      warmup: envInteger('BLUE_ATTACH_PAYNOTE_WARMUP_RUNS', 1),
      measured: envInteger('BLUE_ATTACH_PAYNOTE_MEASURED_RUNS', 3),
    };
    const durations: number[] = [];
    const spans: TimingSpan[] = [];

    for (let index = 0; index < runs.warmup + runs.measured; index += 1) {
      const runSpans: TimingSpan[] = [];
      const processor = processorWithTiming(blue, runSpans);
      const startedAt = performance.now();
      const result = await processor.processDocument(
        document.clone(),
        event.clone(),
      );
      const durationMs = performance.now() - startedAt;

      expect(result.capabilityFailure).toBe(false);
      expect(result.status).toBe(ProcessorStatus.SUCCESS);
      expect(result.document.get('/payment/payNoteAttached')).toBe(true);
      expect(result.document.get('/embeddedDocs/packagePayNote')).toBeTruthy();
      expect(result.triggeredEvents).toEqual([]);
      assertEmbeddedPayNoteContractsPreserved(result.document);
      assertNoJavaScriptRuntime(processor);

      if (index >= runs.warmup) {
        durations.push(durationMs);
        spans.push(...runSpans);
      }
    }

    const budgetMs = Number(
      process.env.BLUE_ATTACH_PAYNOTE_BUDGET_MS ??
        (process.env.BLUE_PERF_STRICT === '1'
          ? STRICT_BUDGET_MS
          : DEFAULT_BUDGET_MS),
    );
    const medianMs = median(durations);

    if (medianMs >= budgetMs || process.env.BLUE_PROCESSOR_TIMING === '1') {
      console.info(
        formatTimingFailure({
          budgetMs,
          medianMs,
          spans,
        }),
      );
    }

    expect(medianMs).toBeLessThan(budgetMs);
  }, 120_000);
});

function processorWithTiming(
  blue: Blue,
  spans: TimingSpan[],
): DocumentProcessor {
  const timingSink: ProcessorTimingSink = {
    mark(name, durationMs, meta) {
      spans.push({ name, durationMs, meta });
    },
  };
  const options: DocumentProcessorOptions = { blue, timingSink };
  return new DocumentProcessor(options);
}

async function initializedProcessorDocument(blue: Blue): Promise<BlueNode> {
  const processor = new DocumentProcessor({ blue });
  const initialized = await processor.initializeDocument(
    blue.resolve(blue.jsonValueToNode(packageOrderDocument())),
  );
  expect(initialized.capabilityFailure).toBe(false);
  const stored = blue.minimize(initialized.document);
  return blue.resolve(stored);
}

function operationRequestEvent(blue: Blue, initialSnapshot: unknown): BlueNode {
  const event = blue.resolve(
    blue.jsonValueToNode({
      type: 'MyOS/MyOS Timeline Entry',
      timeline: { timelineId: 'investor-timeline' },
      timestamp: 1_700_000_000_000,
      actor: {
        type: 'MyOS/Principal Actor',
        accountId: '0',
      },
      message: {
        type: 'Coordination/Operation Request',
        operation: 'attachPayNote',
        request: { initialSnapshot },
      },
    }),
  );
  return blue.createResolvedNode(blue.minimize(event));
}

function packageOrderDocument(): JsonRecord {
  return {
    name: 'Performance Package Order',
    type: 'Common/Record',
    kind: 'Package Order',
    status: 'ready_for_checkout',
    payment: {
      tokenAttached: true,
      payNoteAttached: false,
      state: 'checkout_ready',
      paymentToken: 'checkout-token',
      expectedPayNoteDescriptor: {},
      checkoutMetadata: {},
    },
    embeddedDocs: {
      orders: {},
    },
    contracts: {
      investorChannel: {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'investor-timeline',
      },
      embeddedPackagePayNoteEvents: {
        type: 'Embedded Node Channel',
        childPath: '/embeddedDocs/packagePayNote',
      },
      processEmbeddedDocs: {
        type: 'Process Embedded',
        paths: ['/embeddedDocs/packagePayNote'],
      },
      attachPayNote: {
        type: 'Coordination/Operation',
        channel: 'investorChannel',
        request: {
          initialSnapshot: {
            type: 'PayNote/PayNote',
          },
        },
      },
      attachPayNoteImpl: {
        type: 'Coordination/Sequential Workflow Operation',
        operation: 'attachPayNote',
        steps: [
          {
            name: 'BuildPayNoteAttachment',
            type: 'Coordination/Compute',
            do: [
              {
                $if: {
                  cond: { $document: '/payment/payNoteAttached' },
                  then: [
                    {
                      $return: {
                        changeset: [],
                        events: [],
                      },
                    },
                  ],
                },
              },
              {
                $appendChange: {
                  op: 'add',
                  path: '/embeddedDocs/packagePayNote',
                  val: { $event: '/message/request/initialSnapshot' },
                },
              },
              {
                $appendChange: {
                  op: 'replace',
                  path: '/payment/payNoteAttached',
                  val: true,
                },
              },
              {
                $appendChange: {
                  op: 'replace',
                  path: '/payment/state',
                  val: 'paynote_attached',
                },
              },
              {
                $return: {
                  changeset: { $changeset: true },
                  events: { $events: true },
                },
              },
            ],
          },
        ],
      },
    },
  };
}

function buildMinimizedPayNoteSnapshot(blue: Blue): unknown {
  const payNote = blue.resolve(
    blue.jsonValueToNode({
      name: 'Performance Customer Package PayNote',
      type: 'PayNote/PayNote',
      kind: 'PayNote',
      currency: 'PLN',
      amount: {
        expectedTotal: 49_900,
      },
      context: {
        scenario: 'reseller-weekend-package',
        paymentKind: 'customer_package_purchase',
        packageOrderDocumentId: 'package-order-doc',
        packagePayNoteSessionId: 'customer-paynote-session',
        packagePayNoteDocumentId: 'customer-paynote-doc',
      },
      embeddedDocs: {
        orders: {},
      },
      completionRequested: false,
      contracts: packagePayNoteProcessingContracts(),
    }),
  );
  return blue.nodeToJson(blue.minimize(payNote));
}

function packagePayNoteProcessingContracts(): JsonRecord {
  return {
    sellerChannel: {
      type: 'MyOS/MyOS Timeline Channel',
    },
    embeddedHotelOrderEvents: {
      type: 'Embedded Node Channel',
      childPath: '/embeddedDocs/orders/hotelOrder',
    },
    embeddedRestaurantOrderEvents: {
      type: 'Embedded Node Channel',
      childPath: '/embeddedDocs/orders/restaurantOrder',
    },
    processEmbeddedComponentOrders: {
      type: 'Process Embedded',
      paths: [
        '/embeddedDocs/orders/hotelOrder',
        '/embeddedDocs/orders/restaurantOrder',
      ],
    },
    attachComponentOrder: {
      type: 'Coordination/Operation',
      channel: 'sellerChannel',
      request: {
        kind: { type: 'Text' },
        initialSnapshot: { type: 'Common/Record' },
      },
    },
    attachComponentOrderImpl: {
      type: 'Coordination/Sequential Workflow Operation',
      operation: 'attachComponentOrder',
      steps: [
        {
          name: 'BuildComponentAttachment',
          type: 'Coordination/Compute',
          do: [
            {
              $appendChange: {
                op: 'add',
                path: {
                  $concat: [
                    '/embeddedDocs/orders/',
                    { $event: '/message/request/kind' },
                    'Order',
                  ],
                },
                val: { $event: '/message/request/initialSnapshot' },
              },
            },
            {
              $return: {
                changeset: { $changeset: true },
                events: { $events: true },
              },
            },
          ],
        },
      ],
    },
    links: {
      type: 'MyOS/Document Links',
      packageOrder: {
        type: 'MyOS/Document Link',
        anchor: 'payments',
        documentId: 'package-order-doc',
      },
    },
  };
}

function assertEmbeddedPayNoteContractsPreserved(document: BlueNode): void {
  const embedded = ProcessorEngine.nodeAt(
    document,
    '/embeddedDocs/packagePayNote',
  );
  expect(embedded).toBeInstanceOf(BlueNode);
  const contracts = embedded?.getContracts();
  expect(contracts).toBeDefined();
  const sellerChannel = contracts?.sellerChannel;
  expect(sellerChannel).toBeInstanceOf(BlueNode);
  expect(sellerChannel?.getType()?.getBlueId()).toBe(
    myosBlueIds['MyOS/MyOS Timeline Channel'],
  );
}

function assertNoJavaScriptRuntime(processor: DocumentProcessor): void {
  const processorNames = [...processor.registry().processors().values()]
    .map((item) => item.constructor.name)
    .join(',');
  expect(processorNames).not.toMatch(/QuickJS|JavaScript/i);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function envInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function formatTimingFailure(input: {
  readonly budgetMs: number;
  readonly medianMs: number;
  readonly spans: readonly TimingSpan[];
}): string {
  const totals = new Map<string, number>();
  for (const span of input.spans) {
    totals.set(span.name, (totals.get(span.name) ?? 0) + span.durationMs);
  }
  const topSpans = [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 16)
    .map(
      ([name, durationMs]) => `  ${name.padEnd(38)} ${durationMs.toFixed(2)}ms`,
    )
    .join('\n');

  return [
    'attachPayNote processDocument timing:',
    `  median: ${input.medianMs.toFixed(2)}ms`,
    `  budget: ${input.budgetMs.toFixed(2)}ms`,
    '',
    'Top spans:',
    topSpans,
  ].join('\n');
}
