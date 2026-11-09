import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'rc_session';
export const SESSION_SECONDS = 60 * 60 * 12;

function secrets() {
  const password = process.env.APP_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;
  return password && sessionSecret ? { password, sessionSecret } : null;
}

export const isAuthConfigured = () => secrets() !== null;

const sha256 = (value: string) => createHash('sha256').update(value).digest();
const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('hex');

export function isCorrectPassword(candidate: string): boolean {
  const config = secrets();
  return config !== null && timingSafeEqual(sha256(candidate), sha256(config.password));
}

export function createSessionToken(): string {
  const config = secrets();
  if (!config) throw new Error('Auth is not configured');
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  return `${expires}.${sign(expires, config.sessionSecret)}`;
}

export function isValidSessionToken(token: string | undefined): boolean {
  const config = secrets();
  if (!config || !token) return false;
  const [expires, signature] = token.split('.');
  if (!expires || !signature) return false;
  const expected = Buffer.from(sign(expires, config.sessionSecret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received) && Number(expires) > Date.now();
}
