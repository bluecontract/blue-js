import { blinkBlueIdsSchema, RecommendedUserActionMessage } from '../schema';

export const createRecommendedUserActionMessage = (
  value: Omit<RecommendedUserActionMessage, 'type'>
): RecommendedUserActionMessage => {
  return {
    type: {
      name: 'Recommended User Action Message',
      blueId: blinkBlueIdsSchema.shape.RecommendedUserActionMessage.value,
    },
    ...value,
  };
};
