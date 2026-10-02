import { createHmac, randomBytes } from "node:crypto";

/**
 * OAuth 1.0a (HMAC-SHA1) request signing, used by X and Tumblr. Only query
 * and form-urlencoded body parameters are signed; JSON and multipart bodies
 * are not part of the signature base string.
 */

export interface OAuth1Keys {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
}

export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function oauth1Header(
  method: string,
  url: string,
  keys: OAuth1Keys,
  bodyParams: Record<string, string> = {},
  fixed: { nonce?: string; timestamp?: number } = {}
): string {
  const parsed = new URL(url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: keys.consumerKey,
    oauth_nonce: fixed.nonce ?? randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(fixed.timestamp ?? Math.floor(Date.now() / 1000)),
    oauth_token: keys.token,
    oauth_version: "1.0",
  };
  const pairs: [string, string][] = [];
  parsed.searchParams.forEach((v, k) => pairs.push([percentEncode(k), percentEncode(v)]));
  for (const [k, v] of Object.entries(bodyParams)) pairs.push([percentEncode(k), percentEncode(v)]);
  for (const [k, v] of Object.entries(oauth)) pairs.push([percentEncode(k), percentEncode(v)]);
  pairs.sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : av > bv ? 1 : 0) : ak < bk ? -1 : 1));
  const paramString = pairs.map(([k, v]) => `${k}=${v}`).join("&");
  const baseUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  const base = [method.toUpperCase(), percentEncode(baseUrl), percentEncode(paramString)].join("&");
  const signingKey = `${percentEncode(keys.consumerSecret)}&${percentEncode(keys.tokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(base).digest("base64");
  const header = { ...oauth, oauth_signature: signature };
  return (
    "OAuth " +
    Object.entries(header)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
      .join(", ")
  );
}
