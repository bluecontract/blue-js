import { JsonObject, JsonValue } from 'type-fest';
import {
  Contract,
  actionByParticipantEventSchema,
  initiateContractActionSchema,
} from './schema';
import { jsonTraverseAndFind } from '@blue-company/shared-utils';

export const findAllInitiateContractActions = (contract: Contract) => {
  return contract.workflows?.items.flatMap((workflow) => {
    const actionByParticipantEvents = findActionByParticipantEvents(
      workflow as JsonObject
    );

    if (actionByParticipantEvents.length === 0) {
      return [];
    }

    return actionByParticipantEvents.flatMap((event) => {
      const resultInitiateContractAction =
        initiateContractActionSchema.safeParse(event.action);
      if (!resultInitiateContractAction.success) {
        return [];
      }

      return [resultInitiateContractAction.data];
    });
  });
};

const findActionByParticipantEvents = (json: JsonValue) => {
  const eventsJsonValues = jsonTraverseAndFind(json, (obj) => {
    const resultInitiateContractAction =
      actionByParticipantEventSchema.safeParse(obj);
    return resultInitiateContractAction.success;
  });

  return eventsJsonValues.map((obj) =>
    actionByParticipantEventSchema.parse(obj)
  );
};
