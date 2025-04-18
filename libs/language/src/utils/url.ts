/**
 * Checks if a string is a valid URL
 * @param str - String to check
 * @returns True if the string is a valid URL
 */
export function isUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
