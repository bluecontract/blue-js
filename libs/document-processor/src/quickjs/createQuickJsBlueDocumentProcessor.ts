import { Blue, BlueRepository } from '@blue-labs/language';
import { QuickJsHostBridge } from './QuickJsHostBridge';
import { QuickJsBlueDocumentProcessor } from './QuickJsBlueDocumentProcessor';
import { HostDeterministicAPIs } from './QuickJsHostBridge';

export type QuickJsProcessorHostApis = HostDeterministicAPIs;

export interface QuickJsProcessorFactoryOptions {
  entrySource: string;
  blue?: Blue;
  repositories?: BlueRepository[];
  hostApis?: QuickJsProcessorHostApis;
  globals?: Record<string, unknown>;
}

export interface QuickJsProcessorFactoryResult {
  processor: QuickJsBlueDocumentProcessor;
  bridge: QuickJsHostBridge;
}

export function createQuickJsBlueDocumentProcessor(
  options: QuickJsProcessorFactoryOptions
): QuickJsProcessorFactoryResult {
  const {
    entrySource,
    blue: existingBlue,
    repositories,
    hostApis,
    globals,
  } = options;

  const blue = existingBlue ?? new Blue({ repositories });

  const globalBag: Record<string, unknown> = {
    ...globals,
  };

  const bridge = new QuickJsHostBridge({
    entrySource,
    hostApis,
    globals: globalBag,
  });

  const processor = new QuickJsBlueDocumentProcessor(blue, bridge);
  return { processor, bridge };
}
