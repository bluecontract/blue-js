import { BlueNode } from '@blue-labs/language';
import { z } from 'zod';

import type { Node } from '../../types/index.js';

export const blueNodeSchema: z.ZodType<Node> = z.instanceof(BlueNode) as z.ZodType<Node>;
