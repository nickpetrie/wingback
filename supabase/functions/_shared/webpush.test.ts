import { describe, expect, it } from "vitest";
import { encryptPayload } from "./webpush.ts";

// The test webpush.ts has claimed to have since the day it was written, and
// didn't. It matters more here than anywhere else in the project: a push
// whose payload fails to decrypt is dropped by the browser silently — no
// error reaches the service worker, the push service, or the logs — so the
// only way to know the key derivation is right is to reproduce a vector
// somebody else computed.
//
// RFC 8291 §5, "Push Message Encryption Example". Every value below is from
// that section verbatim.
// https://www.rfc-editor.org/rfc/rfc8291#section-5
const PLAINTEXT = "When I grow up, I want to be a watermelon";
const UA_PUBLIC =
  "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
const AUTH_SECRET = "BTBZMqHH6r4Tts7J_aSIgg";
const AS_PUBLIC =
  "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
const AS_PRIVATE = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
const SALT = "DGv6ra1nlYgDCS1FRnbzlw";
// The complete aes128gcm record: header (salt | record size | key id length |
// key id) followed by the ciphertext.
const EXPECTED =
  "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
  "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
  "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad), (c) =>
    c.charCodeAt(0),
  );
}

function bytesToB64url(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("encryptPayload", () => {
  it("reproduces the RFC 8291 §5 worked example byte for byte", async () => {
    const record = await encryptPayload(PLAINTEXT, UA_PUBLIC, AUTH_SECRET, {
      salt: b64urlToBytes(SALT),
      privateKey: b64urlToBytes(AS_PRIVATE),
      publicKey: b64urlToBytes(AS_PUBLIC),
    });

    // Byte-for-byte: the two HKDF rounds are easy to get backwards (auth
    // secret first, then the message salt) and a swap produces a record that
    // is the right length and complete nonsense.
    expect(bytesToB64url(record)).toBe(EXPECTED);
  });

  it("builds a header the push service can parse", async () => {
    const record = await encryptPayload(PLAINTEXT, UA_PUBLIC, AUTH_SECRET, {
      salt: b64urlToBytes(SALT),
      privateKey: b64urlToBytes(AS_PRIVATE),
      publicKey: b64urlToBytes(AS_PUBLIC),
    });

    expect(record.slice(0, 16)).toEqual(b64urlToBytes(SALT));
    // Record size, big-endian, then the length of the key that follows.
    expect(new DataView(record.buffer, record.byteOffset).getUint32(16, false)).toBe(4096);
    expect(record[20]).toBe(65);
    expect(record.slice(21, 86)).toEqual(b64urlToBytes(AS_PUBLIC));
  });

  it("uses a fresh salt and key per message when none is supplied", async () => {
    // The nonce is derived deterministically from the salt, so reusing a salt
    // with the same key would reuse a nonce — which is how AES-GCM stops
    // being secure at all.
    const a = await encryptPayload(PLAINTEXT, UA_PUBLIC, AUTH_SECRET);
    const b = await encryptPayload(PLAINTEXT, UA_PUBLIC, AUTH_SECRET);
    expect(bytesToB64url(a)).not.toBe(bytesToB64url(b));
  });
});
