import { describe, expect, it } from 'vitest';
import { AgencyBindingsBuilder } from '../agency-bindings-builder.js';
import {
  AgencyOptionsBuilder,
  AgencyCapabilitiesBuilder,
} from '../agency-options-builder.js';

describe('agency helpers', () => {
  it('builds channel bindings map', () => {
    const bindings = new AgencyBindingsBuilder()
      .bind('ownerChannel', {
        accountId: 'acc-1',
        timelineId: 'timeline-1',
      })
      .bind('adminChannel', {
        accountId: 'acc-admin',
      })
      .build();

    expect(bindings).toEqual({
      ownerChannel: {
        accountId: 'acc-1',
        timelineId: 'timeline-1',
      },
      adminChannel: {
        accountId: 'acc-admin',
      },
    });
  });

  it('builds agency worker-session options payload', () => {
    const options = new AgencyOptionsBuilder()
      .defaultMessage('Booting worker')
      .channelMessage('ownerChannel', 'Worker started')
      .capabilities((capabilities: AgencyCapabilitiesBuilder) =>
        capabilities
          .participantsOrchestration(true)
          .sessionInteraction(true)
          .workerAgency(true),
      )
      .build();

    expect(options).toEqual({
      initialMessages: {
        defaultMessage: 'Booting worker',
        perChannel: {
          ownerChannel: 'Worker started',
        },
      },
      capabilities: {
        participantsOrchestration: true,
        sessionInteraction: true,
        workerAgency: true,
      },
    });
  });

  it('rejects legacy bootstrap assignee worker-session options', () => {
    expect(() =>
      new AgencyOptionsBuilder().bootstrapAssignee('myOsAdminChannel'),
    ).toThrow(
      'agency start worker session options do not support bootstrapAssignee',
    );
  });
});
