/**
 * 1:1 port of {@code blue.language.processor.util.ProcessorContractConstants}.
 */
export const KEY_EMBEDDED = 'embedded' as const;
export const KEY_INITIALIZED = 'initialized' as const;
export const KEY_TERMINATED = 'terminated' as const;
export const KEY_CHECKPOINT = 'checkpoint' as const;

const orderedReservedKeys = [
  KEY_EMBEDDED,
  KEY_INITIALIZED,
  KEY_TERMINATED,
  KEY_CHECKPOINT,
] as const;

export const RESERVED_CONTRACT_KEYS: ReadonlySet<string> = new Set(
  orderedReservedKeys
);

/** @todo Wire real managed channel type check in Step 5 (model DTOs). */
export function isProcessorManagedChannel(_contract: unknown): boolean {
  return false;
}

export function isReservedKey(key: string | null | undefined): boolean {
  return key == null ? false : RESERVED_CONTRACT_KEYS.has(key);
}
