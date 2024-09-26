// Generated by ts-to-zod
import { z } from 'zod';

import {
  blueObjectSchema,
  blueObjectStringValueSchema,
} from '@blue-company/language';
import { blinkBlueIdsSchema } from './../blueIds.zod';
import { conversationEntrySchema } from './conversationEntry.zod';

export const recommendedUserActionMessageSchema =
  conversationEntrySchema.extend({
    type: blueObjectSchema
      .and(
        z.object({
          name: z.literal('Recommended User Action Message').optional(),
          blueId:
            blinkBlueIdsSchema.shape.RecommendedUserActionMessage.optional(),
        })
      )
      .optional(),
    message: blueObjectStringValueSchema.optional(),
    action: blueObjectSchema.optional(),
  });