import { Blue } from '@blue-labs/language';
import { ZodError } from 'zod';

import {
  compositeTimelineChannelSchema,
  type CompositeTimelineChannel,
} from '../model/index.js';
import type { ScopeContractsIndex } from '../types/scope-contracts.js';
import { ProcessorErrors } from '../types/errors.js';
import { ProcessorFatalError } from './processor-fatal-error.js';

type CompositeCycleValidationArgs = {
  readonly compositeKey: string;
  readonly contract: CompositeTimelineChannel;
  readonly scopeContracts: ScopeContractsIndex;
  readonly blueId: string;
  readonly blue: Blue;
  readonly compositeChannelBlueId: string;
};

export function assertCompositeChannelIsAcyclic(
  args: CompositeCycleValidationArgs,
): void {
  const {
    compositeKey,
    contract,
    scopeContracts,
    blueId,
    blue,
    compositeChannelBlueId,
  } = args;
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];
  const contractCache = new Map<string, CompositeTimelineChannel | null>([
    [compositeKey, contract],
  ]);

  const loadCompositeContract = (
    key: string,
  ): CompositeTimelineChannel | null => {
    if (contractCache.has(key)) {
      return contractCache.get(key) ?? null;
    }
    const entry = scopeContracts.get(key);
    if (!entry || entry.nodeTypeBlueId !== compositeChannelBlueId) {
      contractCache.set(key, null);
      return null;
    }

    try {
      const parsed = blue.nodeToSchemaOutput(
        entry.node,
        compositeTimelineChannelSchema,
      ) as CompositeTimelineChannel;
      contractCache.set(key, parsed);
      return parsed;
    } catch (error) {
      if (isZodError(error)) {
        throw new ProcessorFatalError(
          'Failed to parse channel contract',
          ProcessorErrors.invalidContract(
            entry.nodeTypeBlueId,
            'Failed to parse channel contract',
            `/contracts/${key}`,
            error,
          ),
        );
      }
      const reason =
        (error as Error | undefined)?.message ??
        'Failed to parse channel contract';
      throw new ProcessorFatalError(
        reason,
        ProcessorErrors.illegalState(reason),
      );
    }
  };

  const visit = (key: string): void => {
    if (visiting.has(key)) {
      const cycleStart = stack.indexOf(key);
      const cyclePath = [...stack.slice(cycleStart), key];
      const cycleDescription = cyclePath.join(' -> ');
      throw new ProcessorFatalError(
        `Composite channel ${compositeKey} has a cyclic reference: ${cycleDescription}`,
        ProcessorErrors.invalidContract(
          blueId,
          `Composite channel '${compositeKey}' has a cyclic reference: ${cycleDescription}`,
          `/contracts/${compositeKey}`,
        ),
      );
    }
    if (visited.has(key)) {
      return;
    }

    visiting.add(key);
    stack.push(key);

    const composite = loadCompositeContract(key);
    if (composite) {
      for (const childKey of composite.channels ?? []) {
        const childEntry = scopeContracts.get(childKey);
        if (
          childEntry &&
          childEntry.nodeTypeBlueId === compositeChannelBlueId
        ) {
          visit(childKey);
        }
      }
    }

    stack.pop();
    visiting.delete(key);
    visited.add(key);
  };

  visit(compositeKey);
}

function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}
