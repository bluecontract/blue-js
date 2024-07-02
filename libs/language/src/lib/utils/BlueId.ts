import { Base58 } from './Base58';

export class BlueId {
  public static BLUE_ID_MAX_LENGTH = 44;
  public static BLUE_ID_MIN_LENGTH = 41;

  public static isPotentialBlueId(value: string): boolean {
    if (
      value.length > BlueId.BLUE_ID_MAX_LENGTH ||
      value.length < BlueId.BLUE_ID_MIN_LENGTH
    ) {
      return false;
    }

    try {
      Base58.decode(value);
      return true;
    } catch (e) {
      return false;
    }
  }
}
