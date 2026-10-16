import { createHash, randomBytes } from "node:crypto";

/** 256-bit random token for cookies and email links (URL-safe). */
export function newToken() {
  return randomBytes(32).toString("base64url");
}

/** Only this hash is stored; a database leak does not reveal usable tokens. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
