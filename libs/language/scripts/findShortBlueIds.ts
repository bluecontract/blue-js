import crypto from 'crypto';
import { Base58 } from '../src/lib/utils/Base58.ts';

function generateRandomHex(size = 16) {
  return crypto.randomBytes(size).toString('hex');
}

function createDataObject() {
  return JSON.stringify({
    type: 'F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP',
    value: generateRandomHex(16),
  });
}

function findHashWithBase58Length(targetLengths = [42, 43]) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = createDataObject();
    const hashBuffer = crypto.createHash('sha256').update(data).digest();
    const base58Encoded = Base58.encode(hashBuffer);
    if (targetLengths.includes(base58Encoded.length)) {
      return { data, hash: hashBuffer.toString('hex'), base58Encoded, attempt };
    }
    attempt++;
  }
}

const result = findHashWithBase58Length();
console.log(`Found data: ${result.data}`);
console.log(`SHA-256 hash: ${result.hash}`);
console.log(`Base58 encoded: ${result.base58Encoded}`);
console.log(`Number of attempts: ${result.attempt}`);
