// Generated by ts-to-zod
import { z } from 'zod';
import { BlueObject, ContractInstance, ProcessingState } from './source';

export const blueObjectSchema: z.ZodSchema<BlueObject> = z.lazy(() =>
  z.record(z.unknown()).and(
    z.object({
      blueId: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      type: blueObjectSchema.optional(),
      value: z
        .union([z.string(), z.number(), z.boolean()])
        .optional()
        .nullable(),
      items: z.array(blueObjectSchema).optional(),
    }),
  ),
);

export const baseBlueObjectSchema = z.object({
  blueId: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  type: blueObjectSchema.optional(),
});

export const contractsListObjectSchema = blueObjectSchema;

export const eventBlueObjectSchema = blueObjectSchema;

export const eventSchema = baseBlueObjectSchema;

export const actionSchema = baseBlueObjectSchema;

export const workflowStepSchema = baseBlueObjectSchema;

const blueObjectStringValueSchema = baseBlueObjectSchema.extend({
  value: z.string().optional(),
});

export const contractPhotoSchema = blueObjectStringValueSchema;

export const timelineEntryBlueObjectSchema = baseBlueObjectSchema.extend({
  id: blueObjectStringValueSchema,
  created: z.unknown().optional(),
  timeline: blueObjectStringValueSchema.optional(),
  timelinePrev: blueObjectStringValueSchema.optional(),
  thread: blueObjectStringValueSchema.optional(),
  threadPrev: blueObjectStringValueSchema.optional(),
  message: blueObjectSchema,
  signature: blueObjectStringValueSchema,
});

export const workflowStepObjectListSchema = baseBlueObjectSchema.extend({
  items: z.array(workflowStepSchema).optional(),
});

export const participantSchema = baseBlueObjectSchema.extend({
  type: blueObjectSchema.and(
    z.object({
      name: z.literal('Participant'),
    }),
  ),
  timeline: blueObjectStringValueSchema.optional(),
  thread: blueObjectStringValueSchema.optional(),
  timelineSource: timelineEntryBlueObjectSchema.optional(),
});

export const participantObjectListSchema = baseBlueObjectSchema.extend({
  items: z.array(participantSchema).optional(),
});

export const workflowSchema = baseBlueObjectSchema.extend({
  steps: workflowStepObjectListSchema.optional(),
  trigger: eventBlueObjectSchema.optional(),
});

export const actionByParticipantEventSchema = eventSchema.extend({
  type: blueObjectSchema
    .and(
      z.object({
        name: z.literal('Action by Participant'),
      }),
    )
    .optional(),
  participant: participantSchema,
  action: actionSchema,
});

export const workflowObjectListSchema = baseBlueObjectSchema.extend({
  items: z.array(workflowSchema).optional(),
});

export const contractSchema = baseBlueObjectSchema.extend({
  participants: z.record(participantObjectListSchema).optional(),
  workflows: workflowObjectListSchema.optional(),
  properties: blueObjectSchema.optional(),
  photo: contractPhotoSchema.optional(),
  contracts: contractsListObjectSchema.optional(),
});

export const initiateContractActionSchema = actionSchema.extend({
  type: blueObjectSchema
    .and(
      z.object({
        name: z.literal('Initiate Contract'),
      }),
    )
    .optional(),
  contract: contractSchema,
});

export const contractInstanceSchema: z.ZodSchema<ContractInstance> = z.lazy(
  () =>
    z.object({
      id: z.number(),
      contractState: contractSchema,
      processingState: processingStateSchema,
    }),
);

export const processingStateSchema: z.ZodSchema<ProcessingState> = z.lazy(() =>
  z.object({
    startedWorkflowCount: z.number(),
    startedLocalContractCount: z.number(),
    localContractInstances: z.array(contractInstanceSchema).optional(),
  }),
);