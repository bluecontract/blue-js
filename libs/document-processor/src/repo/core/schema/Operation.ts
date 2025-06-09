import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId, blueNodeField } from '@blue-labs/language';

export const OperationSchema = withTypeBlueId(blueIds['Operation'])(
  z.object({
    request: blueNodeField().optional(),
    description: z.string().optional(),
    channel: z.string().optional(),
  })
);

export type Operation = z.infer<typeof OperationSchema>;
