import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testData = {
  company: {
    name: 'Blue Tech Solutions',
    departments: [
      {
        id: 'dep1',
        name: 'Engineering',
        employees: Array.from({ length: 50 }, (_, i) => ({
          id: `eng${i}`,
          name: `Engineer ${i}`,
          email: `engineer${i}@bluetech.com`,
          skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
          projects: Array.from({ length: 50 }, (_, j) => ({
            id: `proj${j}`,
            name: `Project ${j}`,
            status: ['active', 'completed', 'pending'][j % 3],
            tasks: Array.from({ length: 100 }, (_, k) => ({
              id: `task${k}`,
              title: `Task ${k}`,
              description: `Detailed description for task ${k} in project ${j}`,
              priority: ['high', 'medium', 'low'][k % 3],
            })),
          })),
        })),
      },
      {
        id: 'dep2',
        name: 'Marketing',
        employees: Array.from({ length: 30 }, (_, i) => ({
          id: `mkt${i}`,
          name: `Marketer ${i}`,
          email: `marketer${i}@bluetech.com`,
          campaigns: Array.from({ length: 8 }, (_, j) => ({
            id: `camp${j}`,
            name: `Campaign ${j}`,
            metrics: {
              impressions: 100000 + j * 50000,
              clicks: 5000 + j * 2500,
              conversions: 100 + j * 50,
            },
          })),
        })),
      },
    ],
    locations: Array.from({ length: 10 }, (_, i) => ({
      id: `loc${i}`,
      city: `City ${i}`,
      country: `Country ${i}`,
      employees: 50 + i * 5,
      facilities: Array.from({ length: 3 }, (_, j) => ({
        id: `fac${j}`,
        type: ['office', 'warehouse', 'laboratory'][j % 3],
        capacity: 100 + j * 50,
      })),
    })),
  },
};

const json = JSON.stringify(testData, null, 2);

writeFile(
  join(__dirname, 'data/testData.mjs'),
  `export const testData = ${json}`
);
writeFile(join(__dirname, 'data/testData.json'), json);
