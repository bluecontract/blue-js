import fs from 'fs';
import {
  createQuickJsBlueDocumentProcessorWithDefaults,
  QuickJsProcessorFactoryWithDefaultsOptions,
} from './createQuickJsBlueDocumentProcessorWithDefaults';
import type { QuickJsProcessorFactoryResult } from './createQuickJsBlueDocumentProcessorWithDefaults';

export interface LoadQuickJsProcessorWithDefaultsOptions
  extends Omit<QuickJsProcessorFactoryWithDefaultsOptions, 'entrySource'> {
  bundlePath: string;
}

export async function loadQuickJsBlueDocumentProcessorFromDefaults(
  options: LoadQuickJsProcessorWithDefaultsOptions
): Promise<QuickJsProcessorFactoryResult> {
  const { bundlePath, ...rest } = options;
  const entrySource = await fs.promises.readFile(bundlePath, 'utf8');
  return createQuickJsBlueDocumentProcessorWithDefaults({ ...rest, entrySource });
}
