import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

// F12-K132: symetryczna kryptografia dla team password vault.
//
// AES-256-GCM: 32-byte key + 12-byte IV per-item + 16-byte auth tag.
// Klucz derived z env `VAULT_KEY` (surowy string >= 32 chars) przez SHA-256
// żeby uniknąć "za krótki secret" errora — plus deterministyczne, nie
// zmienia się między restartami.
//
// Format przechowywany w DB:
//   passwordEnc = base64(ciphertext || authTag)
//   passwordIv  = base64(iv)
//
// KLUCZ SECURITY: encryption at-rest (DB dump ≠ plaintext),
// NIE end-to-end (server widzi plaintext przy encrypt/decrypt).
// Dla e2e trzeba by derive'ować key z user password → większy scope.

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.VAULT_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      "VAULT_KEY env var jest wymagany (>= 32 znaki). Wygeneruj: openssl rand -base64 48",
    );
  }
  // SHA-256 daje deterministyczny 32-byte key z dowolnego długiego stringa.
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encrypt(plain: string): { enc: string; iv: string } {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: Buffer.concat([ciphertext, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decrypt(enc: string, iv: string): string {
  const key = getKey();
  const encBuf = Buffer.from(enc, "base64");
  const ivBuf = Buffer.from(iv, "base64");
  if (encBuf.length < TAG_LEN) {
    throw new Error("Ciphertext za krótki — dane uszkodzone.");
  }
  const ciphertext = encBuf.subarray(0, encBuf.length - TAG_LEN);
  const tag = encBuf.subarray(encBuf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, ivBuf);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}
