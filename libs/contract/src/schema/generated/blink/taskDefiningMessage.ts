import {
  BaseBlueObject,
  BlueObject,
  BlueObjectStringValue,
} from '@blue-company/language';
import { RecommendedUserActionMessage } from './recommendedUserActionMessage';
import { BlinkBlueIds } from '../blueIds';
import { ConversationEntry } from './conversationEntry';

export interface TaskDefiningMessageDetailsObjectList extends BaseBlueObject {
  items?: RecommendedUserActionMessage[];
}

export interface TaskDefiningMessage extends ConversationEntry {
  type?: BlueObject & {
    name?: 'Task Defining Message';
    blueId?: BlinkBlueIds['TaskDefiningMessage'];
  };
  assistantInitialMessage?: BlueObjectStringValue;
  message?: BlueObjectStringValue;
  details?: TaskDefiningMessageDetailsObjectList;
}
