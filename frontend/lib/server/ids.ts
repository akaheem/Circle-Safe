import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Base62-encodes a byte array by long division, so no BigInt (and no ES2020 target) is needed. */
function toBase62(bytes: Buffer): string {
  let digits = Array.from(bytes);
  let out = "";

  while (digits.length) {
    const quotient: number[] = [];
    let remainder = 0;
    for (const digit of digits) {
      const acc = remainder * 256 + digit;
      const q = Math.floor(acc / 62);
      remainder = acc % 62;
      if (quotient.length || q) quotient.push(q);
    }
    out = ALPHABET[remainder] + out;
    digits = quotient;
  }

  return out;
}

/**
 * Stands in for Sub0's `$GENERATOR.KSUID`: a 4-byte big-endian timestamp followed by 16 random
 * bytes, base62-encoded. Lexicographically sortable by creation time, collision-resistant, and
 * it leaks no sequence numbers.
 */
export function newId(): string {
  const stamp = Buffer.alloc(4);
  stamp.writeUInt32BE(Math.floor(Date.now() / 1000));
  return toBase62(Buffer.concat([stamp, randomBytes(16)])).padStart(27, "0");
}
