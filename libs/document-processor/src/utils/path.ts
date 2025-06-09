export const makePath = (...parts: string[]) =>
  parts
    .map((part, index) => {
      if (typeof part !== 'string') return '';

      // Special case for root path
      if (index === 0 && part === '/') return '/';

      // Remove leading slashes for non-first parts
      const withoutLeadingSlash = index > 0 ? part.replace(/^\/+/, '') : part;

      // Remove trailing slashes for non-last parts
      return index < parts.length - 1
        ? withoutLeadingSlash.replace(/\/+$/, '')
        : withoutLeadingSlash;
    })
    .filter(Boolean)
    .join('/')
    .replace(/\/{2,}/g, '/');
