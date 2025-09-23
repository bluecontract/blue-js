import { Blue } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';
import { createQuickJsBlueDocumentProcessor } from './createQuickJsBlueDocumentProcessor';
import type { QuickJsProcessorFactoryOptions, QuickJsProcessorFactoryResult } from './createQuickJsBlueDocumentProcessor';

export type { QuickJsProcessorFactoryResult };

export interface QuickJsProcessorFactoryWithDefaultsOptions
  extends Omit<QuickJsProcessorFactoryOptions, 'entrySource' | 'blue' | 'repositories'> {
  entrySource: string;
  repositories?: QuickJsProcessorFactoryOptions['repositories'];
  blue?: QuickJsProcessorFactoryOptions['blue'];
}

export function createQuickJsBlueDocumentProcessorWithDefaults(
  options: QuickJsProcessorFactoryWithDefaultsOptions
): QuickJsProcessorFactoryResult {
  const repositories = options.repositories ?? [coreRepository, myosRepository];
  const blue = options.blue ?? new Blue({ repositories });

  return createQuickJsBlueDocumentProcessor({
    ...options,
    repositories,
    blue,
  });
}
