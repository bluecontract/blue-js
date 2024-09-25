import { AssistantMessage, blinkBlueIdsSchema } from '../schema';

export const createAssistantMessage = (
  value: Omit<AssistantMessage, 'type'>
): AssistantMessage => {
  return {
    type: {
      name: 'Assistant Message',
      blueId: blinkBlueIdsSchema.shape.AssistantMessage.value,
    },
    ...value,
  };
};
