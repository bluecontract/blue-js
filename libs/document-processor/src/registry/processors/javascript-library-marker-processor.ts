import { JavaScriptLibrarySchema } from '@blue-repository/types/packages/conversation/schemas/JavaScriptLibrary';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import type { MarkerProcessor } from '../types.js';

export type JavaScriptLibraryMarkerContract =
  typeof JavaScriptLibrarySchema._output;

export class JavaScriptLibraryMarkerProcessor implements MarkerProcessor<JavaScriptLibraryMarkerContract> {
  readonly kind = 'marker' as const;
  readonly blueIds = [
    conversationBlueIds['Conversation/JavaScript Library'],
  ] as const;
  readonly typeNames = ['Conversation/JavaScript Library'] as const;
  readonly schema = JavaScriptLibrarySchema;
}
