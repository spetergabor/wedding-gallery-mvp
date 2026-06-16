import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const CODE_DIGITS = 6;
const STEP_SECONDS = 30;

export function generateTotpSecret() {
  return encodeBase32(randomBytes(20));
}

export function createTotpUri({
  accountName,
  issuer,
  secret
}: {
  accountName: string;
  issuer: string;
  secret: string;
}) {
  const label = `${issuer}:${accountName}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(CODE_DIGITS),
    period: String(STEP_SECONDS)
  });

  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function verifyTotpCode(secret: string, code: string) {
  const normalizedCode = code.replace(/\s/g, "");

  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const currentCounter = Math.floor(Date.now() / 1000 / STEP_SECONDS);

  for (let offset = -1; offset <= 1; offset += 1) {
    const expectedCode = generateTotpCode(secret, currentCounter + offset);
    const expected = Buffer.from(expectedCode);
    const actual = Buffer.from(normalizedCode);

    if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
      return true;
    }
  }

  return false;
}

function generateTotpCode(secret: string, counter: number) {
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** CODE_DIGITS).padStart(CODE_DIGITS, "0");
}

function encodeBase32(buffer: Buffer) {
  let bits = "";
  let output = "";

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += ALPHABET[Number.parseInt(chunk, 2)];
  }

  return output;
}

function decodeBase32(secret: string) {
  const normalizedSecret = secret.replace(/=+$/g, "").replace(/\s/g, "").toUpperCase();
  let bits = "";

  for (const character of normalizedSecret) {
    const value = ALPHABET.indexOf(character);

    if (value === -1) {
      throw new Error("Invalid TOTP secret.");
    }

    bits += value.toString(2).padStart(5, "0");
  }

  const bytes = [];

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}
