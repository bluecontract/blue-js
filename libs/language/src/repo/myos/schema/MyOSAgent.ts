import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '@blue-company/schema-annotations';

export const MyOSAgentSchema = withTypeBlueId(blueIds['MyOS Agent'])(
  z.object({
    agentId: z.string().optional(),
  })
);

export type MyOSAgent = z.infer<typeof MyOSAgentSchema>;
