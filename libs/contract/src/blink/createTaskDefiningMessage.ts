import { blinkBlueIdsSchema, TaskDefiningMessage } from '../schema';

export const createTaskDefiningMessage = (
  value: Omit<TaskDefiningMessage, 'type'>
): TaskDefiningMessage => {
  return {
    type: {
      name: 'Task Defining Message',
      blueId: blinkBlueIdsSchema.shape.TaskDefiningMessage.value,
    },
    ...value,
  };
};
