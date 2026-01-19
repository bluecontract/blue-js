import type { BenchFixture } from './types.js';

const ADMIN_TIMELINE_ID = 'bench-quiz-admin';
const PLAYER_A_TIMELINE_ID = 'bench-quiz-player-a';
const PLAYER_B_TIMELINE_ID = 'bench-quiz-player-b';

export const quizFixture = {
  name: 'quiz-bootstrap-worst',
  document: {
    name: 'AI Multiplayer Quiz',
    description: 'Multiplayer MCQ quiz orchestrated by MyOS + AI',
    contracts: {
      initLifecycleChannel: {
        type: 'Core/Lifecycle Event Channel',
      },
      triggeredEventsChannel: {
        type: 'Core/Triggered Event Channel',
      },
      adminChannel: {
        type: 'MyOS/MyOS Timeline Channel',
        description: 'Game admin (X)',
        timelineId: ADMIN_TIMELINE_ID,
      },
      playerAChannel: {
        type: 'MyOS/MyOS Timeline Channel',
        description: 'Player A',
        timelineId: PLAYER_A_TIMELINE_ID,
      },
      playerBChannel: {
        type: 'MyOS/MyOS Timeline Channel',
        description: 'Player B',
        timelineId: PLAYER_B_TIMELINE_ID,
      },
      startRound: {
        type: 'Conversation/Operation',
        channel: 'adminChannel',
        description:
          'Starts a round by setting question/options (no correct answer here!)',
        request: {
          roundIndex: {
            type: 'Integer',
          },
          question: {
            questionId: {
              type: 'Text',
            },
            category: {
              type: 'Text',
            },
            level: {
              type: 'Integer',
            },
            prompt: {
              type: 'Text',
            },
            options: {
              type: 'Dictionary',
              keyType: 'Text',
              valueType: 'Text',
            },
          },
        },
      },
      startRoundImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'startRound',
        steps: [
          {
            name: 'GuardAndEmitRoundStarted',
            type: 'Conversation/JavaScript Code',
            code: `const phase = document('/phase');
if (phase === 'IN_ROUND' || phase === 'GAME_COMPLETED') {
  return {};
}

const req = event.message.request || {};
if (!req || typeof req !== 'object') return {};

const requestedIndex = Number.isInteger(req.roundIndex) ? req.roundIndex : null;
if (requestedIndex === null) {
  return {};
}

const roundsTotal = document('/roundsTotal') ?? 1;
if (requestedIndex < 0 || requestedIndex >= roundsTotal) {
  return {};
}

const currentIndex = document('/roundIndex') ?? 0;
const expectedIndex = phase === 'BETWEEN_ROUNDS' ? currentIndex + 1 : currentIndex;
if (requestedIndex !== expectedIndex) {
  return {};
}

const question = req.question;
if (!question || typeof question !== 'object') {
  return {};
}

const { questionId, category, level, prompt, options } = question;
if (typeof questionId !== 'string' || !questionId.trim()) {
  return {};
}
if (typeof category !== 'string' || !category.trim()) {
  return {};
}
if (typeof prompt !== 'string' || !prompt.trim()) {
  return {};
}

const normalizedQuestionId = questionId.trim();
const normalizedCategory = category.trim();
const normalizedPrompt = prompt.trim();

const allowedCategories = document('/categories');
if (Array.isArray(allowedCategories) && allowedCategories.length > 0) {
  const normalizedAllowed = allowedCategories
    .filter(cat => typeof cat === 'string')
    .map(cat => cat.trim().toLowerCase());
  if (!normalizedAllowed.includes(normalizedCategory.toLowerCase())) {
    return {};
  }
}

const normalizedLevel = Number.isInteger(level) ? level : null;
if (normalizedLevel === null) {
  return {};
}

const allowedChoices = ['A', 'B', 'C', 'D'];
if (!options || typeof options !== 'object') {
  return {};
}
const normalizedOptions = {};
for (const choice of allowedChoices) {
  const value = options[choice];
  if (typeof value !== 'string' || !value.trim()) {
    return {};
  }
  normalizedOptions[choice] = value;
}

return {
  events: [
    {
      type: "Conversation/Event",
      kind: "Round Started",
      roundIndex: requestedIndex,
      question: {
        questionId: normalizedQuestionId,
        category: normalizedCategory,
        level: normalizedLevel,
        prompt: normalizedPrompt,
        options: normalizedOptions,
      },
    },
  ],
};
`,
          },
        ],
      },
      completeRound: {
        type: 'Conversation/Operation',
        channel: 'adminChannel',
        description:
          'Completes the round with the authoritative correct option',
        request: {
          roundIndex: {
            type: 'Integer',
          },
          questionId: {
            type: 'Text',
          },
          correctOption: {
            type: 'Text',
          },
          explanation: {
            type: 'Text',
          },
        },
      },
      completeRoundImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'completeRound',
        steps: [
          {
            name: 'GuardComputeAndEmit',
            type: 'Conversation/JavaScript Code',
            code: `// ---- Guards ----
const phase = document('/phase');
if (phase !== 'IN_ROUND') return {};  // must be in a live round
const curQ = document('/currentQuestion');
if (!curQ) return {};
const req = event.message.request;
const docIdx = document('/roundIndex') ?? 0;
if (req.roundIndex !== docIdx) return {};
if (req.questionId !== curQ.questionId) return {};
const correct = (req.correctOption || '').trim().toUpperCase();
if (!['A','B','C','D'].includes(correct)) return {};

// ---- Compute results (answers may be missing; timeouts OK) ----
const answers = document('/answers') || {};
const aAns = answers.playerA ?? null;
const bAns = answers.playerB ?? null;

const scoreboard = document('/scoreboard') || { playerA: 0, playerB: 0 };
const aPoint = aAns === correct ? 1 : 0;
const bPoint = bAns === correct ? 1 : 0;
const newBoard = {
  playerA: (scoreboard.playerA || 0) + aPoint,
  playerB: (scoreboard.playerB || 0) + bPoint,
};

const roundsTotal = document('/roundsTotal') || 1;
const nextIndex = req.roundIndex + 1;
const hasMore = nextIndex < roundsTotal;

const results = {
  roundIndex: req.roundIndex,
  questionId: req.questionId,
  correctOption: correct,
  explanation: req.explanation,
  answers: { playerA: aAns, playerB: bAns },
  pointsAwarded: { playerA: aPoint, playerB: bPoint },
  scoreboard: newBoard
};

const events = [{ type: "Conversation/Event", kind: "Round Completed", results }];
if (hasMore) {
  events.push({ type: "Conversation/Event", kind: "Round Requested", nextRoundIndex: nextIndex });
} else {
  const maxScore = Math.max(newBoard.playerA, newBoard.playerB);
  const winners = [];
  if (newBoard.playerA === maxScore) winners.push("playerA");
  if (newBoard.playerB === maxScore) winners.push("playerB");
  events.push({ type: "Conversation/Event", kind: "Game Completed", scoreboard: newBoard, winners });
}
return { events };
`,
          },
        ],
      },
      answerA: {
        type: 'Conversation/Operation',
        channel: 'playerAChannel',
        description: 'Player A answers current question',
        request: {
          type: 'Text',
        },
      },
      answerAImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'answerA',
        steps: [
          {
            name: 'GuardAndEmitAnswerA',
            type: 'Conversation/JavaScript Code',
            code: `const phase = document('/phase');
if (phase !== 'IN_ROUND') return {};
const curQ = document('/currentQuestion');
if (!curQ) return {};
const prev = document('/answers/playerA');
if (prev !== undefined && prev !== null) return {};   // already answered
const raw = (event.message.request || '').trim().toUpperCase();
if (!['A','B','C','D'].includes(raw)) return {};
if (!curQ.options || !(raw in curQ.options)) return {}; // must match existing option
return { events: [{ type: "Conversation/Event", kind: "Answer Submitted", player: "playerA", choice: raw }] };
`,
          },
        ],
      },
      answerB: {
        type: 'Conversation/Operation',
        channel: 'playerBChannel',
        description: 'Player B answers current question',
        request: {
          type: 'Text',
        },
      },
      answerBImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'answerB',
        steps: [
          {
            name: 'GuardAndEmitAnswerB',
            type: 'Conversation/JavaScript Code',
            code: `const phase = document('/phase');
if (phase !== 'IN_ROUND') return {};
const curQ = document('/currentQuestion');
if (!curQ) return {};
const prev = document('/answers/playerB');
if (prev !== undefined && prev !== null) return {};   // already answered
const raw = (event.message.request || '').trim().toUpperCase();
if (!['A','B','C','D'].includes(raw)) return {};
if (!curQ.options || !(raw in curQ.options)) return {};
return { events: [{ type: "Conversation/Event", kind: "Answer Submitted", player: "playerB", choice: raw }] };
`,
          },
        ],
      },
      validateOnInit: {
        type: 'Conversation/Sequential Workflow',
        channel: 'initLifecycleChannel',
        event: {
          type: 'Core/Document Processing Initiated',
        },
        steps: [
          {
            name: 'ValidateInputs',
            type: 'Conversation/JavaScript Code',
            code: `const issues = [];
const roundsTotal = document('/roundsTotal');
const categories = document('/categories');
const level = document('/level');
if (!roundsTotal || roundsTotal < 1) issues.push("roundsTotal must be >= 1");
if (!Array.isArray(categories) || categories.length === 0) issues.push("categories must be a non-empty list");
if (typeof level !== 'number' || level < 0 || level > 2) issues.push("level must be 0..2");
if (issues.length > 0) {
  return { events: [ { type: "Conversation/Event", kind: "Status Change", status: { type: "Conversation/Status Failed" }, issues } ] };
}
return { events: [
  { type: "Conversation/Event", kind: "Status Change", status: { type: "Conversation/Status In Progress" } },
  { type: "Conversation/Event", kind: "Round Requested", nextRoundIndex: 0 }
] };
`,
          },
        ],
      },
      onStatusChange: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventsChannel',
        event: {
          type: 'Conversation/Event',
          kind: 'Status Change',
        },
        steps: [
          {
            name: 'UpdateStatus',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/status',
                val: '${event.status}',
              },
            ],
          },
        ],
      },
      onRoundStarted: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventsChannel',
        event: {
          type: 'Conversation/Event',
          kind: 'Round Started',
        },
        steps: [
          {
            name: 'ApplyRoundStart',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/status',
                val: {
                  type: 'Conversation/Status In Progress',
                },
              },
              {
                op: 'replace',
                path: '/roundIndex',
                val: '${event.roundIndex}',
              },
              {
                op: 'replace',
                path: '/currentQuestion',
                val: '${event.question}',
              },
              {
                op: 'replace',
                path: '/answers',
                val: {},
              },
              {
                op: 'replace',
                path: '/phase',
                val: 'IN_ROUND',
              },
            ],
          },
        ],
      },
      onAnswerSubmittedA: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventsChannel',
        event: {
          type: 'Conversation/Event',
          kind: 'Answer Submitted',
          player: 'playerA',
        },
        steps: [
          {
            name: 'RecordA',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'add',
                path: '/answers/playerA',
                val: '${event.choice}',
              },
            ],
          },
        ],
      },
      onAnswerSubmittedB: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventsChannel',
        event: {
          type: 'Conversation/Event',
          kind: 'Answer Submitted',
          player: 'playerB',
        },
        steps: [
          {
            name: 'RecordB',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'add',
                path: '/answers/playerB',
                val: '${event.choice}',
              },
            ],
          },
        ],
      },
      onRoundCompleted: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventsChannel',
        event: {
          type: 'Conversation/Event',
          kind: 'Round Completed',
        },
        steps: [
          {
            name: 'ApplyResults',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/scoreboard',
                val: '${event.results.scoreboard}',
              },
              {
                op: 'replace',
                path: '/lastRoundResult',
                val: '${event.results}',
              },
              {
                op: 'replace',
                path: '/phase',
                val: 'BETWEEN_ROUNDS',
              },
              {
                op: 'remove',
                path: '/currentQuestion',
              },
              {
                op: 'replace',
                path: '/answers',
                val: {},
              },
            ],
          },
        ],
      },
      onGameCompleted: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventsChannel',
        event: {
          type: 'Conversation/Event',
          kind: 'Game Completed',
        },
        steps: [
          {
            name: 'Finish',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/status',
                val: {
                  type: 'Conversation/Status Completed',
                },
              },
              {
                op: 'replace',
                path: '/winners',
                val: '${event.winners}',
              },
              {
                op: 'replace',
                path: '/phase',
                val: 'GAME_COMPLETED',
              },
            ],
          },
        ],
      },
    },
    roundsTotal: 2,
    categories: ['History', 'Science'],
    level: 1,
    roundIndex: 0,
    status: {
      type: 'Conversation/Status Pending',
    },
  },
  events: [
    {
      type: 'Conversation/Timeline Entry',
      timeline: {
        timelineId: ADMIN_TIMELINE_ID,
      },
      message: {
        type: 'Conversation/Operation Request',
        operation: 'startRound',
        request: {
          roundIndex: 0,
          question: {
            questionId: 'q1',
            category: 'History',
            level: 1,
            prompt: 'Who discovered penicillin?',
            options: {
              A: 'Alexander Fleming',
              B: 'Marie Curie',
              C: 'Isaac Newton',
              D: 'Albert Einstein',
            },
          },
        },
      },
      timestamp: 1700000200,
    },
    {
      type: 'Conversation/Timeline Entry',
      timeline: {
        timelineId: PLAYER_A_TIMELINE_ID,
      },
      message: {
        type: 'Conversation/Operation Request',
        operation: 'answerA',
        request: 'A',
      },
      timestamp: 1700000201,
    },
    {
      type: 'Conversation/Timeline Entry',
      timeline: {
        timelineId: PLAYER_B_TIMELINE_ID,
      },
      message: {
        type: 'Conversation/Operation Request',
        operation: 'answerB',
        request: 'B',
      },
      timestamp: 1700000202,
    },
    {
      type: 'Conversation/Timeline Entry',
      timeline: {
        timelineId: ADMIN_TIMELINE_ID,
      },
      message: {
        type: 'Conversation/Operation Request',
        operation: 'completeRound',
        request: {
          roundIndex: 0,
          questionId: 'q1',
          correctOption: 'A',
          explanation: 'Fleming discovered penicillin.',
        },
      },
      timestamp: 1700000203,
    },
  ],
} satisfies BenchFixture;
