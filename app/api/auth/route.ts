import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, ApiError, jsonBody } from '@/src/lib/api';
import {
  createSessionToken,
  isAuthConfigured,
  isCorrectPassword,
  isValidSessionToken,
  SESSION_COOKIE,
  SESSION_SECONDS,
} from '@/src/lib/session';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
} as const;

export async function GET(req: NextRequest) {
  return NextResponse.json({
    configured: isAuthConfigured(),
    authenticated: isValidSessionToken(req.cookies.get(SESSION_COOKIE)?.value),
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthConfigured()) throw new ApiError(503, 'Falta configurar APP_PASSWORD y SESSION_SECRET');
    const { password } = await jsonBody(req);
    if (typeof password !== 'string' || !isCorrectPassword(password)) throw new ApiError(401, 'Clave incorrecta');
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(), { ...cookieOptions, maxAge: SESSION_SECONDS });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  return response;
}
