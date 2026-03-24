const textEncoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return toHex(signatureBuffer);
}

export async function signaturesMatch(
  secret: string,
  payload: string,
  providedSignature?: string | null,
): Promise<boolean> {
  if (!providedSignature) return false;
  const expected = await hmacSha256Hex(secret, payload);
  return expected === providedSignature;
}
