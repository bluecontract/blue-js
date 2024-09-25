import { blinkBlueIdsSchema, UserMessage } from '../schema';

export const createUserMessage = (
  value: Omit<UserMessage, 'type'>
): UserMessage => {
  return {
    type: {
      name: 'User Message',
      blueId: blinkBlueIdsSchema.shape.UserMessage.value,
    },
    ...value,
  };
};
