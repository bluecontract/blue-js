import canonicalize from 'canonicalize';

export class JsonCanonicalizer {
  static canonicalize(input: unknown) {
    return canonicalize(input);
  }
}
