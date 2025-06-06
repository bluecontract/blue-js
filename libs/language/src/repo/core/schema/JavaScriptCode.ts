import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '@blue-company/schema-annotations';

export const JavaScriptCodeSchema = withTypeBlueId(blueIds['JavaScript Code'])(
  z.object({
    code: z.string().optional(),
  })
);

export type UpdateDocument = z.infer<typeof JavaScriptCodeSchema>;
