import { z } from 'zod';
import { blueNodeField, Properties, withTypeBlueId } from '@blue-labs/language';

const runtimeBlueIds =
  Properties.BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP;

export const ContractSchema = withTypeBlueId(runtimeBlueIds.Contract)(
  z.object({
    description: z.string().optional(),
    name: z.string().optional(),
    order: z.number().optional(),
  }),
);

export type Contract = z.infer<typeof ContractSchema>;

export const ChannelSchema = withTypeBlueId(runtimeBlueIds.Channel)(
  ContractSchema.extend({
    description: z.string().optional(),
    event: blueNodeField().optional(),
    name: z.string().optional(),
  }),
);

export type Channel = z.infer<typeof ChannelSchema>;

export const HandlerSchema = withTypeBlueId(runtimeBlueIds.Handler)(
  ContractSchema.extend({
    channel: z.string().optional(),
    description: z.string().optional(),
    event: blueNodeField().optional(),
    name: z.string().optional(),
  }),
);

export type Handler = z.infer<typeof HandlerSchema>;

export const MarkerSchema = withTypeBlueId(runtimeBlueIds.Marker)(
  ContractSchema.extend({
    description: z.string().optional(),
    name: z.string().optional(),
  }),
);

export type Marker = z.infer<typeof MarkerSchema>;

export const DocumentUpdateChannelSchema = withTypeBlueId(
  runtimeBlueIds['Document Update Channel'],
)(
  ChannelSchema.extend({
    description: z.string().optional(),
    name: z.string().optional(),
    path: z.string().optional(),
  }),
);

export type DocumentUpdateChannel = z.infer<typeof DocumentUpdateChannelSchema>;

export const EmbeddedNodeChannelSchema = withTypeBlueId(
  runtimeBlueIds['Embedded Node Channel'],
)(
  ChannelSchema.extend({
    childPath: z.string().optional(),
    description: z.string().optional(),
    name: z.string().optional(),
  }),
);

export type EmbeddedNodeChannel = z.infer<typeof EmbeddedNodeChannelSchema>;

export const LifecycleEventChannelSchema = withTypeBlueId(
  runtimeBlueIds['Lifecycle Event Channel'],
)(
  ChannelSchema.extend({
    description: z.string().optional(),
    name: z.string().optional(),
  }),
);

export type LifecycleEventChannel = z.infer<typeof LifecycleEventChannelSchema>;

export const TriggeredEventChannelSchema = withTypeBlueId(
  runtimeBlueIds['Triggered Event Channel'],
)(
  ChannelSchema.extend({
    description: z.string().optional(),
    name: z.string().optional(),
  }),
);

export type TriggeredEventChannel = z.infer<typeof TriggeredEventChannelSchema>;

export const ChannelEventCheckpointSchema = withTypeBlueId(
  runtimeBlueIds['Channel Event Checkpoint'],
)(
  MarkerSchema.extend({
    description: z.string().optional(),
    lastEvents: z.record(z.string(), blueNodeField()).optional(),
    name: z.string().optional(),
  }),
);

export type ChannelEventCheckpoint = z.infer<
  typeof ChannelEventCheckpointSchema
>;

export const ProcessingInitializedMarkerSchema = withTypeBlueId(
  runtimeBlueIds['Processing Initialized Marker'],
)(
  MarkerSchema.extend({
    description: z.string().optional(),
    documentId: z.string().optional(),
    name: z.string().optional(),
  }),
);

export type ProcessingInitializedMarker = z.infer<
  typeof ProcessingInitializedMarkerSchema
>;

export const ProcessEmbeddedSchema = withTypeBlueId(
  runtimeBlueIds['Process Embedded'],
)(
  MarkerSchema.extend({
    description: z.string().optional(),
    name: z.string().optional(),
    paths: z.array(z.string()).optional(),
  }),
);

export type ProcessEmbedded = z.infer<typeof ProcessEmbeddedSchema>;

export const ProcessingTerminatedMarkerSchema = withTypeBlueId(
  runtimeBlueIds['Processing Terminated Marker'],
)(
  MarkerSchema.extend({
    cause: z.string().optional(),
    description: z.string().optional(),
    name: z.string().optional(),
    reason: z.string().optional(),
  }),
);

export type ProcessingTerminatedMarker = z.infer<
  typeof ProcessingTerminatedMarkerSchema
>;
