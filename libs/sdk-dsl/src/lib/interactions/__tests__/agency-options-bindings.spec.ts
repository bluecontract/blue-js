import { describe, expect, it } from 'vitest';
import { AgencyBindingsBuilder } from '../agency-bindings-builder.js';
import { AgencyOptionsBuilder } from '../agency-options-builder.js';

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

  it('builds agency bootstrap options payload', () => {
    const options = new AgencyOptionsBuilder()
      .bootstrapAssignee('myOsAdminChannel')
      .defaultMessage('Booting worker')
      .channelMessage('ownerChannel', 'Worker started')
      .build();

    expect(options).toEqual({
      bootstrapAssignee: 'myOsAdminChannel',
      initialMessages: {
        defaultMessage: 'Booting worker',
        perChannel: {
          ownerChannel: 'Worker started',
        },
      },
    });
  });
});
