import { z } from 'zod';
import { BlueId as BlueIdService } from '../lib/utils/BlueId';
import { Base58 } from '../lib/utils/Base58';

export const blueIdSchema = z
  .string()
  .max(BlueIdService.BLUE_ID_MAX_LENGTH, {
    message: 'Blue Id has a maximum length of 44 characters',
  })
  .min(BlueIdService.BLUE_ID_MIN_LENGTH, {
    message: 'Blue Id has a minimum length of 41 characters',
  })
  .refine(
    (data) => {
      try {
        Base58.decode(data);
        return true;
      } catch (e) {
        return false;
      }
    },
    {
      message: 'Blue Id must be a valid Base58 string',
    }
  );

export type BlueId = z.infer<typeof blueIdSchema>;
