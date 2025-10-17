import { z } from 'zod';

export const contractBaseSchema = z.object({
  key: z.string().min(1).optional(),
  order: z.number().int().optional(),
});

export type ContractBase = z.infer<typeof contractBaseSchema>;
