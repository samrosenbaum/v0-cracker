import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'https://localhost:3000',
]);

const ENV_ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.APP_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
]
  .filter((value): value is string => Boolean(value))
  .map(origin => origin.replace(/\/$/, ''));

ENV_ALLOWED_ORIGINS.forEach(origin => {
  if (!origin) return;
  try {
    const url = new URL(origin);
    DEFAULT_ALLOWED_ORIGINS.add(`${url.protocol}//${url.host}`);
  } catch (error) {
    console.warn('[CORS] Ignoring invalid origin from environment', origin, error);
  }
});

const ALLOWED_HEADERS = [
  'content-type',
  'authorization',
  'x-client-info',
  'apikey',
  'accept',
  'accept-language',
  'access-control-request-headers',
];

export function resolveAllowedOrigin(request: NextRequest): string {
  const originHeader = request.headers.get('origin');

  if (originHeader) {
    if (DEFAULT_ALLOWED_ORIGINS.has(originHeader)) {
      return originHeader;
    }

    if (ENV_ALLOWED_ORIGINS.some(allowed => allowed === originHeader)) {
      return originHeader;
    }

    // Echo back the provided origin so credentialed requests continue to work.
    console.warn('[CORS] Allowing unrecognised origin and echoing back header', originHeader);
    return originHeader;
  }

  try {
    return request.nextUrl.origin;
  } catch (error) {
    console.warn('[CORS] Unable to derive origin from request URL, falling back to wildcard', error);
    return '*';
  }
}

export function withCorsHeaders(
  request: NextRequest,
  response: NextResponse,
  extraHeaders: Record<string, string> = {}
) {
  const origin = resolveAllowedOrigin(request);
  const requestedHeaders = request.headers
    .get('access-control-request-headers')
    ?.split(',')
    .map(header => header.trim().toLowerCase())
    .filter(Boolean);

  const allowHeaders = new Set<string>(ALLOWED_HEADERS);

  if (requestedHeaders) {
    requestedHeaders.forEach(header => allowHeaders.add(header));
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': Array.from(allowHeaders).join(', '),
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    ...extraHeaders,
  };

  if (origin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export function optionsPreflight(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return withCorsHeaders(request, response);
}
