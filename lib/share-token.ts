// F12-K79: token generator dla public share linków.
// randomBytes(24) → 192 bity entropii, base64url (URL-safe bez kropek).
// To znaczy ~6.3 * 10^57 możliwych tokenów. Bruteforce niemożliwy.

import { randomBytes } from "node:crypto";

export function generateShareToken(): string {
  // 24 bytes → 32 znaki base64url. Wystarczająco krótkie dla URL, długie
  // dla unguessable. Większość konkurencji używa 22-32 znaków.
  return randomBytes(24).toString("base64url");
}
