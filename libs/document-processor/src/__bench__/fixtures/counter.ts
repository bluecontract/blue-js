import type { BenchFixture } from './types.js';

const OWNER_TIMELINE_ID = 'bench-owner';

export const counterFixture = {
  name: 'counter-small',
  document: {
    name: 'Counter - Bench',
    counter: 0,
    contracts: {
      ownerChannel: {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: OWNER_TIMELINE_ID,
      },
      increment: {
        type: 'Conversation/Operation',
        description: 'Increment the counter by the given number',
        channel: 'ownerChannel',
        request: {
          description:
            'Represents a value by which counter will be incremented',
          type: 'Integer',
        },
      },
      incrementImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'increment',
        steps: [
          {
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/counter',
                val: "${event.message.request + document('/counter')}",
              },
            ],
          },
          {
            name: 'CreateMessageEvent',
            type: 'Conversation/JavaScript Code',
            code: `
const message = \`Counter was incremented by \${event.message.request} and is now \${document('/counter')}\`;

return {
  events: [
    {
      type: "Conversation/Chat Message",
      message: message,
    },
  ],
};
`,
          },
        ],
      },
      decrement: {
        type: 'Conversation/Operation',
        description: 'Decrement the counter by the given number',
        channel: 'ownerChannel',
        request: {
          type: 'Integer',
          description: 'Value to subtract',
        },
      },
      decrementImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'decrement',
        steps: [
          {
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/counter',
                val: "${document('/counter') - event.message.request}",
              },
            ],
          },
          {
            name: 'CreateMessageEvent',
            type: 'Conversation/JavaScript Code',
            code: `
const message = \`Counter was decremented by \${event.message.request} and is now \${document('/counter')}\`;

return {
  events: [
    {
      type: "Conversation/Chat Message",
      message: message,
    },
  ],
};
`,
          },
        ],
      },
    },
  },
  events: [
    {
      type: 'Conversation/Timeline Entry',
      timeline: {
        timelineId: OWNER_TIMELINE_ID,
      },
      message: {
        type: 'Conversation/Operation Request',
        operation: 'increment',
        request: 5,
      },
      timestamp: 1700000000,
    },
    {
      type: 'Conversation/Timeline Entry',
      timeline: {
        timelineId: OWNER_TIMELINE_ID,
      },
      message: {
        type: 'Conversation/Operation Request',
        operation: 'decrement',
        request: 2,
      },
      timestamp: 1700000001,
    },
  ],
} satisfies BenchFixture;
