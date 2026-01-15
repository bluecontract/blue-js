import { ZodError, ZodType } from 'zod';
import { BlueNode } from '@blue-labs/language';
import type { Blue } from '@blue-labs/language';

import type { ContractBundleBuilder } from './contract-bundle.js';
import type { ChannelContract, HandlerContract } from '../model/index.js';
import { ProcessorErrors } from '../types/errors.js';
import { ProcessorFatalError } from './processor-fatal-error.js';
import type { ContractProcessorRegistry } from '../registry/contract-processor-registry.js';
import type { HandlerProcessor } from '../registry/types.js';
import type { ScopeContractsIndex } from '../types/scope-contracts.js';

interface RegisterHandlerArgs {
  builder: ContractBundleBuilder;
  key: string;
  node: BlueNode;
  processor: HandlerProcessor<unknown>;
  blueId: string;
  scopeContracts: ScopeContractsIndex;
}

export class HandlerRegistrationService {
  constructor(
    private readonly blue: Blue,
    private readonly registry: ContractProcessorRegistry,
    private readonly builtinChannelSchemas: ReadonlyMap<
      string,
      ZodType<ChannelContract>
    >,
  ) {}

  register({
    builder,
    key,
    node,
    processor,
    blueId,
    scopeContracts,
  }: RegisterHandlerArgs): void {
    try {
      const schema = processor.schema as ZodType<HandlerContract>;
      const contract = this.blue.nodeToSchemaOutput(
        node,
        schema,
      ) as HandlerContract;

      const channelKey = this.resolveChannelKey({
        contract,
        processor: processor as HandlerProcessor<HandlerContract>,
        scopeContracts,
        handlerKey: key,
      });

      const channelEntry = scopeContracts.get(channelKey);
      if (!channelEntry) {
        throw new ProcessorFatalError(
          `Handler ${key} references unknown channel '${channelKey}'`,
          ProcessorErrors.invalidContract(
            blueId,
            `Channel '${channelKey}' is not declared in this scope`,
            `/contracts/${channelKey}`,
          ),
        );
      }

      if (!this.isRegisteredChannel(channelEntry.nodeTypeBlueId)) {
        throw new ProcessorFatalError(
          `Contract '${channelKey}' is not a channel`,
          ProcessorErrors.invalidContract(
            channelEntry.nodeTypeBlueId,
            `Contract '${channelKey}' is not a channel`,
            `/contracts/${channelKey}`,
          ),
        );
      }

      const contractNode = node.clone();
      this.setContractChannel(contractNode, channelKey);
      builder.addHandler(
        key,
        { ...contract, channel: channelKey },
        blueId,
        contractNode,
      );
    } catch (error) {
      if (this.isZodError(error)) {
        throw new ProcessorFatalError(
          'Failed to parse handler contract',
          ProcessorErrors.invalidContract(
            blueId,
            'Failed to parse handler contract',
            key,
            error,
          ),
        );
      }
      const reason =
        (error as Error | undefined)?.message ??
        'Failed to register handler contract';
      throw new ProcessorFatalError(
        reason,
        ProcessorErrors.illegalState(reason),
      );
    }
  }

  private resolveChannelKey({
    contract,
    processor,
    scopeContracts,
    handlerKey,
  }: {
    contract: HandlerContract;
    processor: HandlerProcessor<HandlerContract>;
    scopeContracts: ScopeContractsIndex;
    handlerKey: string;
  }): string {
    let channelKey: string | null =
      typeof contract.channel === 'string' ? contract.channel.trim() : null;
    if (channelKey && channelKey.length === 0) {
      channelKey = null;
    }

    if (!channelKey) {
      const derived =
        processor.deriveChannel?.call(processor, contract, {
          blue: this.blue,
          scopeContracts,
        }) ?? null;
      if (typeof derived === 'string') {
        const trimmed = derived.trim();
        if (trimmed.length > 0) {
          channelKey = trimmed;
        }
      }
    }

    if (!channelKey) {
      throw new ProcessorFatalError(
        `Handler ${handlerKey} must declare channel (missing explicit channel and derivation failed)`,
        ProcessorErrors.illegalState(
          `Handler ${handlerKey} must declare channel (missing explicit channel and derivation failed)`,
        ),
      );
    }

    return channelKey;
  }

  private isRegisteredChannel(nodeTypeBlueId: string): boolean {
    if (this.builtinChannelSchemas.has(nodeTypeBlueId)) {
      return true;
    }
    return this.registry.lookupChannel(nodeTypeBlueId) != null;
  }

  private setContractChannel(node: BlueNode, channelKey: string): void {
    const properties = node.getProperties();
    const existing = properties?.channel;
    if (existing instanceof BlueNode) {
      existing.setValue(channelKey);
      return;
    }
    node.addProperty('channel', new BlueNode().setValue(channelKey));
  }

  private isZodError(error: unknown): error is ZodError {
    return error instanceof ZodError;
  }
}
