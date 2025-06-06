import z from 'zod';
import {
  blueIdField,
  blueNodeField,
  withTypeBlueId,
} from '@blue-company/schema-annotations';

const WorkflowStepSchema = withTypeBlueId('WorkflowStep-BlueId')(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    condition: blueNodeField().optional(),
  })
);

export const TriggerEventStepSchema = withTypeBlueId(
  '6sdEGwtrVJhdto5CsDzm81YrJtHTZrdsenZkyCWJLniU'
)(
  WorkflowStepSchema.extend({
    event: blueNodeField().optional(),
  })
);

export const UpdateStepSchema = withTypeBlueId(
  'DpdjTNXQdgWGxDyB1LLUNFvxSNNM9L9qGMoKZxzYMDoB'
)(
  WorkflowStepSchema.extend({
    changeset: z
      .array(
        z.object({
          op: z.enum(['replace', 'add', 'remove']).optional(),
          path: z.string().optional(),
          val: blueNodeField().optional(),
        })
      )
      .optional(),
  })
);

export const JavaScriptCodeStepSchema = withTypeBlueId(
  'CFKAD5Up8XpNyPHwRBEwiwSUdfFUoGqVVsW29k6te88p'
)(
  WorkflowStepSchema.extend({
    code: z.string().optional(),
  })
);

const WorkflowSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  trigger: blueNodeField().optional(),
  steps: z.array(WorkflowStepSchema).optional(),
});

const ParticipantSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  timeline: blueIdField('timeline').optional(),
});

const MessagingSchema = z.object({
  participants: z.record(ParticipantSchema).optional(),
});

export const ContractSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  messaging: MessagingSchema.optional(),
  workflows: z.array(WorkflowSchema).optional(),
});

export const ChessProperties = z.object({
  chessboard: z.string().optional(),
  winner: z.string().optional(),
  draw: z.boolean().optional(),
  gameOver: z.boolean().optional(),
  playerToMove: z.string().optional(),
  assistingContract: z.string().optional(),
  assistingContractWhite: z.string().optional(),
  assistingContractBlack: z.string().optional(),
});

export const ChessContractSchema = ContractSchema.extend({
  properties: ChessProperties.optional(),
});
