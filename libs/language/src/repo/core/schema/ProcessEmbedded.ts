import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '@blue-company/schema-annotations';

export const ProcessEmbeddedSchema = withTypeBlueId(
  blueIds['Process Embedded']
)(
  z.object({
    paths: z.array(z.string()).optional(),
  })
);

export type ProcessEmbedded = z.infer<typeof ProcessEmbeddedSchema>;
