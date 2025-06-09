import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId, blueNodeField } from '@blue-labs/language';

export const OperationRequestSchema = withTypeBlueId(
  blueIds['Operation Request']
)(
  z.object({
    operation: z.string().optional(),
    request: blueNodeField(),
    document: z
      .object({
        blueId: z.string().optional(),
      })
      .optional(),
    allowNewerVersion: z.boolean().optional(),
  })
);

export type OperationRequest = z.infer<typeof OperationRequestSchema>;
