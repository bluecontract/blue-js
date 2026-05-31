import { Blue, BlueNode } from '@blue-labs/language';

import {
  calculateContentBlueId,
  calculateRuntimeContentBlueId,
} from '../util/content-blue-id.js';
import { ProcessorErrorCategory } from '../types/document-processing-result.js';
import { ProcessorErrors } from '../types/errors.js';
import { ProcessorFatalError } from './processor-fatal-error.js';

export type CheckpointIdentityMode =
  | 'contentBlueId'
  | 'nodeBlueId'
  | 'eventId'
  | 'channelDefined';

export interface CheckpointIdentityResult {
  readonly identity: string;
  readonly subject: BlueNode | null;
}

export class CheckpointIdentityService {
  constructor(private readonly blue: Blue) {}

  identityFor(
    event: BlueNode | null,
    mode: CheckpointIdentityMode = 'contentBlueId',
    channelDefinedSubject?: BlueNode | null,
  ): CheckpointIdentityResult {
    const subject = mode === 'channelDefined' ? channelDefinedSubject : event;
    switch (mode) {
      case 'contentBlueId':
        return {
          identity: this.contentBlueId(event),
          subject: event?.clone() ?? null,
        };
      case 'nodeBlueId':
        return {
          identity: this.nodeBlueId(event),
          subject: event?.clone() ?? null,
        };
      case 'eventId':
        return {
          identity: this.eventId(event),
          subject: event?.clone() ?? null,
        };
      case 'channelDefined':
        return {
          identity: this.contentBlueId(subject ?? null),
          subject: subject?.clone() ?? null,
        };
    }
  }

  private contentBlueId(event: BlueNode | null): string {
    if (!event) {
      return this.fail('event is missing');
    }
    try {
      return calculateRuntimeContentBlueId(this.blue, event);
    } catch (error) {
      return this.fail(formatIdentityError(error));
    }
  }

  private nodeBlueId(event: BlueNode | null): string {
    if (!event) {
      return this.fail('event is missing');
    }
    try {
      return calculateContentBlueId(event);
    } catch (error) {
      return this.fail(
        `event is not valid BlueId input: ${formatIdentityError(error)}`,
      );
    }
  }

  private eventId(event: BlueNode | null): string {
    const value = event?.getProperties()?.eventId?.getValue();
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    return this.fail('eventId identity mode requires a non-empty eventId');
  }

  private fail(message: string): never {
    throw new ProcessorFatalError(
      `CheckpointError: ${message}`,
      ProcessorErrors.runtimeFatal('CheckpointError'),
      ProcessorErrorCategory.CheckpointError,
    );
  }
}

function formatIdentityError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
