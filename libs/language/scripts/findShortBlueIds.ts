import crypto from 'crypto';
import bs58 from 'bs58';

function generateRandomHex(size = 16) {
  return crypto.randomBytes(size).toString('hex');
}

function createDataObject() {
  return JSON.stringify({
    type: { blueId: 'DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K' },
    value: generateRandomHex(16),
  });
}

function findHashWithBase58Length(targetLengths = [42, 43]) {
  let attempt = 0;
  while (true) {
    const data = createDataObject();
    const hashBuffer = crypto.createHash('sha256').update(data).digest();
    const base58Encoded = bs58.encode(hashBuffer);
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
