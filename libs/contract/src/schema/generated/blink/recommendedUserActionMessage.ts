import { BlueObject, BlueObjectStringValue } from '@blue-labs/language';
import { BlinkBlueIds } from '../blueIds';
import { ConversationEntry } from './conversationEntry';

export interface RecommendedUserActionMessage extends ConversationEntry {
  type?: BlueObject & {
    name?: 'Recommended User Action Message';
    blueId?: BlinkBlueIds['RecommendedUserActionMessage'];
  };
  message?: BlueObjectStringValue;
  action?: BlueObject;
}
