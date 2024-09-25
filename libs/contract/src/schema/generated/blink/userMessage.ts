import {
  BlueObject,
  BlueObjectBooleanValue,
  BlueObjectStringValue,
  BlueObjectStringListItems,
} from '@blue-company/language';
import { BlinkBlueIds } from '../blueIds';
import { ConversationEntry } from './conversationEntry';

export interface UserMessage extends ConversationEntry {
  type?: BlueObject & {
    name?: 'User Message';
    blueId?: BlinkBlueIds['UserMessage'];
  };
  message?: BlueObjectStringValue;
  generateResponse?: BlueObjectBooleanValue;
  contracts?: Record<string, string>;
  relevantAssistantTypes?: BlueObjectStringListItems;
  relevantContractTypes?: BlueObjectStringListItems;
}
