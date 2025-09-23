import fs from 'fs';
import path from 'path';
import {
  createQuickJsBlueDocumentProcessor,
  QuickJsProcessorFactoryOptions,
  QuickJsProcessorFactoryResult,
} from './createQuickJsBlueDocumentProcessor';

export interface LoadQuickJsProcessorOptions
  extends Omit<QuickJsProcessorFactoryOptions, 'entrySource'> {
  bundlePath: string;
}

export async function loadQuickJsBlueDocumentProcessorFromBundle(
  options: LoadQuickJsProcessorOptions
): Promise<QuickJsProcessorFactoryResult> {
  const { bundlePath, ...rest } = options;
  const absolutePath = path.resolve(bundlePath);
  const entrySource = await fs.promises.readFile(absolutePath, 'utf8');
  return createQuickJsBlueDocumentProcessor({ ...rest, entrySource });
}
