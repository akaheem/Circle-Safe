import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "./db";
import { newId } from "./ids";

/**
 * Password hashing and JWTs for the self-hosted runtime — the equivalents of Sub0's
 * `hashables` / `verify_hashables` (BCRYPT), `tokenize` (JWT HS256) and `invalidate_tokenize`.
 */

const ROUNDS = 12; // Sub0's default cost
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN ?? "7d";
const EXPIRES_IN: jwt.SignOptions["expiresIn"] = JWT_EXPIRES === "never" || JWT_EXPIRES === "0"
  ? undefined
  : JWT_EXPIRES as jwt.SignOptions["expiresIn"];

function secret(): string {
  const key = process.env.JWT_SECRET_KEY;
  if (!key) throw new Error("JWT_SECRET_KEY is not set — refusing to sign or verify tokens.");
  if (key.length < 32) throw new Error("JWT_SECRET_KEY must be at least 32 characters.");
  return key;
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export interface Claims {
  id: string;
  jti: string;
  exp: number;
}

export function signToken(userId: string): string {
  return jwt.sign({ id: userId }, secret(), {
    algorithm: "HS256",
    expiresIn: EXPIRES_IN,
    jwtid: newId(),
  });
}

/** Returns the verified claims, or null for a missing / invalid / expired / revoked token. */
export async function verifyToken(token: string | null): Promise<Claims | null> {
  if (!token) return null;
  let claims: Claims;
  try {
    claims = jwt.verify(token, secret(), { algorithms: ["HS256"] }) as Claims;
  } catch {
    return null;
  }
  if (!claims?.id || !claims.jti) return null;

  const revoked = await query<{ jti: string }>("SELECT jti FROM _revoked_tokens WHERE jti = $1", [
    claims.jti,
  ]);
  return revoked.length ? null : claims;
}

/** Revokes the presented tokens until their own expiry passes. */
export async function revokeTokens(tokens: string[]): Promise<number> {
  let revoked = 0;
  for (const token of tokens) {
    let claims: Claims;
    try {
      claims = jwt.verify(token, secret(), { algorithms: ["HS256"] }) as Claims;
    } catch {
      continue; // already invalid — nothing to revoke
    }
    if (!claims?.jti) continue;
    // Non-expiring tokens get a far-future expiry so the revocation record persists.
    const exp = claims.exp ?? 4102444800; // 1 Jan 2100
    await query(
      `INSERT INTO _revoked_tokens (jti, expires_at) VALUES ($1, to_timestamp($2))
       ON CONFLICT (jti) DO NOTHING`,
      [claims.jti, exp],
    );
    revoked += 1;
  }
  // Opportunistic cleanup so the table can't grow without bound.
  await query("DELETE FROM _revoked_tokens WHERE expires_at < now()");
  return revoked;
}

/** Pulls the bearer token out of an Authorization header (or an x-access-token header). */
export function bearer(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth) {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (match) return match[1];
    return auth.trim() || null;
  }
  return headers.get("x-access-token");
}
