import type { HandlerProcessor } from '../../registry/types.js';
import { ProcessorFatalError } from '../../engine/processor-fatal-error.js';
import { ProcessorErrors } from '../../types/errors.js';
import { BlueNode } from '@blue-labs/language';
import {
  assertDocumentUpdateSchema,
  type AssertDocumentUpdate,
} from '../models/index.js';

function toPrimitive(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  // Big.js numbers provide toNumber and toString
  const withToNumber = value as { toNumber?: unknown };
  if (typeof withToNumber.toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  if (typeof value === 'object') {
    const withToString = value as { toString?: unknown };
    if (typeof withToString.toString === 'function') {
      const str = (value as { toString: () => string }).toString();
      if (!Number.isNaN(Number(str))) return Number(str);
      return str;
    }
  }
  return value as string | number | boolean;
}

function getRequiredProperty(event: BlueNode | null, key: string): BlueNode {
  const node = event?.getProperties()?.[key] ?? null;
  if (!(node instanceof BlueNode)) {
    const message = `Document Update event missing property '${key}'`;
    throw new ProcessorFatalError(
      message,
      ProcessorErrors.illegalState(message)
    );
  }
  return node;
}

export class AssertDocumentUpdateContractProcessor
  implements HandlerProcessor<AssertDocumentUpdate>
{
  readonly kind = 'handler' as const;
  readonly blueIds = ['AssertDocumentUpdate'] as const;
  readonly schema = assertDocumentUpdateSchema;

  execute(
    contract: AssertDocumentUpdate,
    context: Parameters<HandlerProcessor<AssertDocumentUpdate>['execute']>[1]
  ): void {
    const event = context.event();
    const pathNode = getRequiredProperty(event as BlueNode, 'path');
    if (contract.expectedPath !== toPrimitive(pathNode.getValue())) {
      const message = `Expected path ${
        contract.expectedPath
      } but was ${toPrimitive(pathNode.getValue())}`;
      throw new ProcessorFatalError(
        message,
        ProcessorErrors.illegalState(message)
      );
    }

    const opNode = getRequiredProperty(event as BlueNode, 'op');
    if (contract.expectedOp !== toPrimitive(opNode.getValue())) {
      const message = `Expected op ${contract.expectedOp} but was ${toPrimitive(
        opNode.getValue()
      )}`;
      throw new ProcessorFatalError(
        message,
        ProcessorErrors.illegalState(message)
      );
    }

    this.validateValue(
      getRequiredProperty(event as BlueNode, 'before'),
      !!contract.expectBeforeNull,
      contract.expectedBeforeValue,
      'before'
    );
    this.validateValue(
      getRequiredProperty(event as BlueNode, 'after'),
      !!contract.expectAfterNull,
      contract.expectedAfterValue,
      'after'
    );
  }

  private validateValue(
    node: BlueNode,
    expectNull: boolean,
    expectedValue: number | undefined,
    label: string
  ): void {
    const value = node.getValue();
    if (expectNull) {
      if (value != null) {
        const message = `Expected ${label} to be null, but was ${toPrimitive(
          value
        )}`;
        throw new ProcessorFatalError(
          message,
          ProcessorErrors.illegalState(message)
        );
      }
      return;
    }
    if (expectedValue == null) return;

    const numeric = toPrimitive(value);
    if (typeof numeric !== 'number') {
      const message = `Expected ${label} to be numeric but was ${String(
        numeric
      )}`;
      throw new ProcessorFatalError(
        message,
        ProcessorErrors.illegalState(message)
      );
    }
    if (numeric !== expectedValue) {
      const message = `Expected ${label} value ${expectedValue} but was ${numeric}`;
      throw new ProcessorFatalError(
        message,
        ProcessorErrors.illegalState(message)
      );
    }
  }
}
