import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '../../../schema/annotations/typeBlueId';
import { blueNodeField } from '../../../schema/annotations/blueNode';

export const MyOSAgentEventSchema = withTypeBlueId(blueIds['MyOS Agent Event'])(
  z.object({
    agentId: z.string().optional(),
    id: z.number().optional(),
    timestamp: z.number().optional(),
    event: blueNodeField().optional(),
  })
);

export type MyOSAgentEvent = z.infer<typeof MyOSAgentEventSchema>;
