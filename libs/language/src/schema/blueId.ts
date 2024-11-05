import { z } from 'zod';
import { BlueIds as BlueIdsService } from '../lib/utils/BlueIds';
import { bs58 } from '../utils/bs58';

export const blueIdSchema = z
  .string()
  .max(BlueIdsService.MAX_BLUE_ID_LENGTH, {
    message: 'Blue Id has a maximum length of 45 characters',
  })
  .min(BlueIdsService.MIN_BLUE_ID_LENGTH, {
    message: 'Blue Id has a minimum length of 41 characters',
  })
  .refine(
    (data) => {
      try {
        bs58.decode(data);
        return true;
      } catch {
        return false;
      }
    },
    {
      message: 'Blue Id must be a valid Base58 string',
    }
  );

export type BlueId = z.infer<typeof blueIdSchema>;
