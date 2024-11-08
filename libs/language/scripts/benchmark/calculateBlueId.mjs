import { testData } from './data/testData.mjs';
import { performance, PerformanceObserver } from 'perf_hooks';
import { NodeDeserializer, BlueIdCalculator } from '../../dist/index.mjs';

const obs = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  let totalTime = 0;
  let iterationCount = 0;

  entries.forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}`);
    if (entry.name.startsWith('Iteration')) {
      totalTime += entry.duration;
      iterationCount++;
    }
  });

  if (iterationCount > 0) {
    console.log(`\nAverage iteration time: ${totalTime / iterationCount} ms`);
  }
});
obs.observe({ entryTypes: ['measure'], buffered: true });

const node = NodeDeserializer.deserialize(testData);

async function runProfile() {
  // Warm up phase
  for (let i = 0; i < 2; i++) {
    await BlueIdCalculator.calculateBlueId(node);
  }

  performance.mark('start');

  for (let i = 0; i < 10; i++) {
    performance.mark(`iteration-${i}-start`);
    await BlueIdCalculator.calculateBlueId(node);
    performance.mark(`iteration-${i}-end`);
    performance.measure(
      `Iteration ${i}`,
      `iteration-${i}-start`,
      `iteration-${i}-end`
    );
  }

  performance.mark('end');
  performance.measure('Total Runtime', 'start', 'end');
}

runProfile().then(() => {
  console.log('Profiling complete');
});
