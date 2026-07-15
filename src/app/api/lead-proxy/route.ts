import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// /api/lead-proxy
// ---------------------------------------------------------------------------
// A CORS-enabled server-side proxy.
// External websites (e.g. https://www.pltci.org) submit lead forms to this
// endpoint instead of directly to /api/webhook.  Because this route adds
// permissive CORS headers, the browser is satisfied.  The route then
// server-side forwards the payload to /api/webhook — which never touches
// the browser, so no CORS check applies.
//
// ✅ To add a new website — NO code changes needed.
//    Just add its origin to the LEAD_PROXY_ALLOWED_ORIGINS environment variable
//    (comma-separated) in your .env.local or hosting dashboard and redeploy.
//
//    Example:
//    LEAD_PROXY_ALLOWED_ORIGINS=https://www.pltci.org,https://newsite.com
// ---------------------------------------------------------------------------

/**
 * Reads allowed origins from the LEAD_PROXY_ALLOWED_ORIGINS env var.
 * Falls back to localhost for local dev if the variable is not set.
 */
function getAllowedOrigins(): string[] {
  const raw = process.env.LEAD_PROXY_ALLOWED_ORIGINS || '';
  const fromEnv = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Always allow localhost variants and tsmu.co.in
  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:8000',
    'http://localhost:5173',
    'https://tsmu.co.in',
  ];

  return [...new Set([...fromEnv, ...devOrigins])];
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();

  // Echo back the exact origin if it is in the allow-list, otherwise deny
  const allowedOrigin =
    origin && allowedOrigins.includes(origin)
      ? origin
      : 'null'; // "null" tells the browser the request is not allowed

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

// Handle preflight OPTIONS request (browser sends this first)
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  // Block requests from origins not in the allow-list
  const allowedOrigins = getAllowedOrigins();
  if (origin && !allowedOrigins.includes(origin)) {
    console.warn(`[lead-proxy] Blocked request from unlisted origin: ${origin}`);
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403, headers: corsHeaders(origin) },
    );
  }

  try {
    const body = await req.json();

    // Forward to the internal webhook endpoint (server-to-server, no CORS)
    const internalWebhookUrl = new URL('/api/webhook', req.url).toString();

    const forwardRes = await fetch(internalWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await forwardRes.json().catch(() => ({}));

    return NextResponse.json(data, {
      status: forwardRes.ok ? 200 : forwardRes.status,
      headers: corsHeaders(origin),
    });
  } catch (error: any) {
    console.error('[lead-proxy] Error forwarding lead:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to forward lead' },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}
