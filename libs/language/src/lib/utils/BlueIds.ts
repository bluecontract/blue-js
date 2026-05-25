import { bs58 } from '../../utils/bs58';

export class BlueIds {
  public static readonly MIN_BLUE_ID_LENGTH = 41;
  public static readonly MAX_BLUE_ID_LENGTH = 45;
  public static readonly ZERO_BLUE_ID = '0'.repeat(44);
  private static readonly PLAIN_BLUE_ID_PATTERN = /^[1-9A-HJ-NP-Za-km-z]+$/;
  private static readonly CYCLIC_MEMBER_PATTERN =
    /^([1-9A-HJ-NP-Za-km-z]+)#(0|[1-9]\d*)$/;
  private static readonly THIS_MEMBER_PATTERN = /^this#(0|[1-9]\d*)$/;
  private static readonly ZERO_PLACEHOLDER_PATTERN = /^0{44}$/;

  public static isPotentialBlueId(value: string): boolean {
    try {
      this.requireBlueIdOrCyclicMember(value, 'blueId');
      return true;
    } catch {
      return false;
    }
  }

  public static requirePlainBlueId(value: string | undefined, path: string) {
    if (
      value === undefined ||
      value.length === 0 ||
      !this.PLAIN_BLUE_ID_PATTERN.test(value)
    ) {
      throw new Error(`Expected canonical Base58 SHA-256 BlueId at ${path}.`);
    }
    try {
      const decoded = bs58.decode(value);
      if (decoded.length !== 32 || bs58.encode(decoded) !== value) {
        throw new Error();
      }
    } catch {
      throw new Error(`Expected canonical Base58 SHA-256 BlueId at ${path}.`);
    }
    return value;
  }

  public static requireBlueIdOrCyclicMember(
    value: string | undefined,
    path: string,
  ) {
    if (value === undefined) {
      throw new Error(`Expected BlueId at ${path}.`);
    }
    const cyclic = value.match(this.CYCLIC_MEMBER_PATTERN);
    if (cyclic !== null) {
      this.requirePlainBlueId(cyclic[1], path);
      return value;
    }
    if (value.includes('#')) {
      throw new Error(`Invalid cyclic BlueId member syntax at ${path}.`);
    }
    return this.requirePlainBlueId(value, path);
  }

  public static requireNoThisPlaceholderOutsideCyclicApi(
    value: string | undefined,
    path: string,
  ) {
    if (
      value !== undefined &&
      (value === 'this' || this.THIS_MEMBER_PATTERN.test(value))
    ) {
      throw new Error(
        `"this" BlueId placeholders are valid only inside cyclic BlueId calculation APIs. Path: ${path}`,
      );
    }
    return value;
  }

  public static isCyclicCalculationPlaceholder(value: string | undefined) {
    return (
      value !== undefined &&
      (value === 'this' ||
        this.THIS_MEMBER_PATTERN.test(value) ||
        this.ZERO_PLACEHOLDER_PATTERN.test(value))
    );
  }
}
