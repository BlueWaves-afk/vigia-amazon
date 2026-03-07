import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const apiUrl =
      process.env.NEXT_PUBLIC_INNOVATION_API_URL ||
      'https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod';

    const response = await fetch(
      `${apiUrl}/economic/metrics?${new URLSearchParams({ sessionId }).toString()}`
    );

    const data = await response.json().catch(() => undefined);
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
