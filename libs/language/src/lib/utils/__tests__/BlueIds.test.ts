import { describe, it, expect } from 'vitest';
import { BlueIds } from '../BlueIds';

describe('BlueIds', () => {
  const validBlueIds = [
    '4Yj5XZbpuS1quJHsLbxsAnNHTV1XbhgQar2zQBDzrat7',
    '4Yj5XZbpuS1quJHsLbxsAnNHTV1XbhgQar2zQBDzrat7#12',
  ];

  const invalidBlueIds = [
    '',
    '4Yj5XZbpuS1quJHsLbxsAnNHTV1XbhgQar2zQBDzrat',
    '4Yj5XZbpuS1quJHsLbxsAnNHTV1XbhgQar2zQBDzrat7A',
    '4Yj5XZbpuS1quJHsLbxsAnNHTV1XbhgQar2zQBDzrat7#',
    '4Yj5XZbpuS1quJHsLbxsAnNHTV1XbhgQar2zQBDzrat7#-1',
    '4Yj5XZbpuS1quJHsLbxsAnNHTV1XbhgQar2zQBDzrat7#abc',
    '4Yj5XZbpuS1quJHsLbxsAnNHTV1XbhgQar2zQBDzrat7#12#34',
    '0Yj5XZbpuS1quJHsLbxsAnNHTV1XbhgQar2zQBDzrat7',
    '4Yj5XZbpuS1quJHsLbxsAnNHTV1XbhgQar2zQBDzrat7O',
    '4Yj5XZbpuS1quJHsLbxsAnNHTV1XbhgQar2zQBDzrat7I',
    '4Yj5XZbpuS1quJHsLbxsAnNHTV1XbhgQar2zQBDzrat7l',
  ];

  validBlueIds.forEach((id) => {
    it(`should validate potential BlueId: ${id} as valid`, () => {
      expect(BlueIds.isPotentialBlueId(id)).toBeTruthy();
    });
  });

  invalidBlueIds.forEach((id) => {
    it(`should validate potential BlueId: ${id} as invalid`, () => {
      expect(BlueIds.isPotentialBlueId(id)).toBeFalsy();
    });
  });
});
