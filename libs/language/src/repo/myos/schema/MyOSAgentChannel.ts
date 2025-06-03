import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '../../../schema/annotations/typeBlueId';
import { ChannelSchema } from '../../core';
import { blueNodeField } from '../../../schema/annotations/blueNode';
import { MyOSAgentSchema } from './MyOSAgent';

export const MyOSAgentChannelSchema = withTypeBlueId(
  blueIds['MyOS Agent Channel']
)(
  ChannelSchema.extend({
    agent: MyOSAgentSchema.optional(),
    event: blueNodeField().optional(),
  })
);

export type MyOSAgentChannel = z.infer<typeof MyOSAgentChannelSchema>;
