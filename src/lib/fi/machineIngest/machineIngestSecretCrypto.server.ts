import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

export function deriveMachineIngestMasterKey(raw: string | undefined): Buffer | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  return createHash("sha256").update(t, "utf8").digest();
}

/** Format: base64url(iv || tag || ciphertext) for storage in fi_machine_ingest_hmac_keys.secret_encrypted */
export function encryptMachineIngestSecret(plaintextUtf8: string, masterKey: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, masterKey, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(plaintextUtf8, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, enc]);
  return packed.toString("base64url");
}

export function decryptMachineIngestSecret(packedBase64Url: string, masterKey: Buffer): string {
  const packed = Buffer.from(packedBase64Url, "base64url");
  if (packed.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Invalid ciphertext length.");
  }
  const iv = packed.subarray(0, IV_LEN);
  const tag = packed.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = packed.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, masterKey, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
