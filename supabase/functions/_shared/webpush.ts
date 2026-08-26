// Web Push: VAPID auth (RFC 8292) + aes128gcm payload encryption (RFC 8291).
//
// Hand-rolled on WebCrypto rather than pulled from npm, for the same reason
// _shared/google.ts hand-rolls its JWT: this runs on Deno, and the ecosystem
// libraries reach for node's crypto/https. The difference is that getting this
// wrong is silent — a push that fails to decrypt is dropped by the browser with
// no error anyone sees — so every step below is pinned by the test vector in
// RFC 8291 §5, which webpush.test.ts reproduces byte for byte.
//
// Nothing here touches Deno globals, so the same module runs under Node for
// that test.

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

const enc = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToB64url(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** An uncompressed P-256 point (0x04 || X || Y) as a JWK, optionally with the
 * private scalar — WebCrypto won't take the raw forms the Push API hands out. */
function pointToJwk(point: Uint8Array, d?: Uint8Array): JsonWebKey {
  if (point.length !== 65 || point[0] !== 4) {
    throw new Error(`expected a 65-byte uncompressed P-256 point, got ${point.length}`);
  }
  return {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(point.subarray(1, 33)),
    y: bytesToB64url(point.subarray(33, 65)),
    ...(d ? { d: bytesToB64url(d) } : {}),
    ext: true,
  };
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data as BufferSource));
}

/** HKDF as RFC 8291 uses it: one-block expand, so info || 0x01. */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const prk = await hmac(salt, ikm);
  const okm = await hmac(prk, concat(info, Uint8Array.of(1)));
  return okm.subarray(0, length);
}

/** Encrypt a payload for one subscription. `salt` and `serverKeys` are only
 * ever passed by the test — in production both are freshly random per message,
 * which is what makes the nonce safe to derive deterministically. */
export async function encryptPayload(
  payload: string,
  p256dhB64: string,
  authB64: string,
  fixed?: { salt: Uint8Array; privateKey: Uint8Array; publicKey: Uint8Array },
): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(p256dhB64);
  const authSecret = b64urlToBytes(authB64);

  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));

  let asPublic: Uint8Array;
  let asPrivateKey: CryptoKey;
  if (fixed) {
    asPublic = fixed.publicKey;
    asPrivateKey = await crypto.subtle.importKey(
      "jwk",
      pointToJwk(fixed.publicKey, fixed.privateKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
  } else {
    const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ])) as CryptoKeyPair;
    asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    asPrivateKey = pair.privateKey;
  }

  const uaKey = await crypto.subtle.importKey(
    "jwk",
    pointToJwk(uaPublic),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPrivateKey, 256),
  );

  // The key derivation is salted with the *auth secret* first, then with the
  // message salt — two rounds, and swapping them silently produces garbage the
  // browser will refuse.
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, { name: "AES-GCM" }, false, [
    "encrypt",
  ]);
  // 0x02 is the last-record delimiter; a single record means no padding after it.
  const plaintext = concat(enc.encode(payload), Uint8Array.of(2));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource, tagLength: 128 },
      aesKey,
      plaintext as BufferSource,
    ),
  );

  // aes128gcm header: salt(16) | record size(4, BE) | key id length(1) | key id
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  return concat(salt, recordSize, Uint8Array.of(asPublic.length), asPublic, ciphertext);
}

/** VAPID Authorization header: a short-lived ES256 JWT naming the push service
 * as audience, plus the public key the service checks it against. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys): Promise<string> {
  const audience = new URL(endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const body = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: vapid.subject,
  };

  const signingInput = `${bytesToB64url(enc.encode(JSON.stringify(header)))}.${bytesToB64url(
    enc.encode(JSON.stringify(body)),
  )}`;

  const key = await crypto.subtle.importKey(
    "jwk",
    pointToJwk(b64urlToBytes(vapid.publicKey), b64urlToBytes(vapid.privateKey)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // WebCrypto emits the raw r||s ECDSA signature JWS wants, not DER.
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      enc.encode(signingInput) as BufferSource,
    ),
  );

  return `vapid t=${signingInput}.${bytesToB64url(sig)}, k=${vapid.publicKey}`;
}

export interface PushResult {
  ok: boolean;
  status: number;
  /** The subscription is dead and should be deleted, not retried. */
  gone: boolean;
  error?: string;
}

export async function sendPush(
  subscription: PushSubscription,
  payload: string,
  vapid: VapidKeys,
  ttlSeconds = 6 * 60 * 60,
): Promise<PushResult> {
  const body = await encryptPayload(payload, subscription.p256dh, subscription.auth);
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, vapid),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttlSeconds),
      Urgency: "normal",
    },
    body: body as BodyInit,
  });

  // 404/410 mean the browser threw the subscription away — uninstalled, cleared
  // site data, or permission revoked. Anything else might work next time.
  const gone = res.status === 404 || res.status === 410;
  return {
    ok: res.ok,
    status: res.status,
    gone,
    error: res.ok ? undefined : `${res.status}: ${(await res.text()).slice(0, 200)}`,
  };
}
