import { NextRequest, NextResponse } from 'next/server';

const TELEMETRY_API =
  process.env.NEXT_PUBLIC_TELEMETRY_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.driverWalletAddress) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    const upstream = await fetch(`${TELEMETRY_API}/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) console.error('[/api/telemetry] Upstream error:', upstream.status, data);
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error('[/api/telemetry] Proxy error:', error);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 });
  }
}
