import bs58 from 'bs58';

export class BlueIds {
  public static readonly MIN_BLUE_ID_LENGTH = 41;
  public static readonly MAX_BLUE_ID_LENGTH = 45;
  private static readonly BLUE_ID_PATTERN =
    /^[1-9A-HJ-NP-Za-km-z]{41,45}(?:#\d+)?$/;

  public static isPotentialBlueId(value: string): boolean {
    if (!value || value.length === 0) {
      return false;
    }

    if (!this.BLUE_ID_PATTERN.test(value)) {
      return false;
    }

    const parts = value.split('#');
    const blueIdPart = parts[0];

    const blueIdLength = blueIdPart.length;
    if (
      blueIdLength < this.MIN_BLUE_ID_LENGTH ||
      blueIdLength > this.MAX_BLUE_ID_LENGTH
    ) {
      return false;
    }

    try {
      const decoded = bs58.decode(blueIdPart);
      if (decoded.length !== 32) {
        return false;
      }
    } catch (e) {
      return false;
    }

    if (parts.length > 1) {
      try {
        const index = Number(parts[1]);
        if (index < 0) {
          return false;
        }
      } catch (e) {
        return false;
      }
    }

    return true;
  }
}
