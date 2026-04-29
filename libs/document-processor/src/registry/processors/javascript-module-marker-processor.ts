import { z } from 'zod';

import {
  JAVASCRIPT_MODULE_BLUE_ID,
  JAVASCRIPT_MODULE_TYPE_NAME,
} from '../../constants/javascript-module-constants.js';
import type { MarkerProcessor } from '../types.js';

export const javascriptModuleContractSchema = z
  .object({
    specifier: z.string(),
    source: z.string(),
    sourceMap: z.string().optional(),
  })
  .passthrough();

export type JavaScriptModuleMarkerContract = z.infer<
  typeof javascriptModuleContractSchema
>;

export class JavaScriptModuleMarkerProcessor implements MarkerProcessor<JavaScriptModuleMarkerContract> {
  readonly kind = 'marker' as const;
  readonly blueIds = [JAVASCRIPT_MODULE_BLUE_ID] as const;
  readonly typeNames = [JAVASCRIPT_MODULE_TYPE_NAME] as const;
  readonly schema = javascriptModuleContractSchema;
}
