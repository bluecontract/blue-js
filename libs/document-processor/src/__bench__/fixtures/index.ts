import { counterFixture } from './counter.js';
import { quizFixture } from './quiz.js';
import { subscriptionListenerFixture } from './subscription-listener.js';

export { counterFixture, quizFixture, subscriptionListenerFixture };
export type { BenchFixture } from './types.js';

export const fixtures = [
  counterFixture,
  subscriptionListenerFixture,
  quizFixture,
];
