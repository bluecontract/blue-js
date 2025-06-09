import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '@blue-labs/language';

export const JavaScriptCodeSchema = withTypeBlueId(blueIds['JavaScript Code'])(
  z.object({
    code: z.string().optional(),
  })
);

export type JavaScriptCode = z.infer<typeof JavaScriptCodeSchema>;
