import {
  BlueObject,
  BlueObjectStringListItems,
  BlueObjectStringValue,
} from '@blue-company/language';
import { BlinkBlueIds } from '../blueIds';
import { ConversationEntry } from './conversationEntry';

export interface AssistantMessage extends ConversationEntry {
  type?: BlueObject & {
    name?: 'Assistant Message';
    blueId?: BlinkBlueIds['AssistantMessage'];
  };
  message?: BlueObjectStringValue;
  priority?: BlueObjectStringValue;
  contracts?: Record<string, string[]>;
  relevantAssistantTypes?: BlueObjectStringListItems;
  relevantContractTypes?: BlueObjectStringListItems;
}
