import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Use Ingestion API (where ledger endpoint exists)
    const apiUrl = process.env.NEXT_PUBLIC_TELEMETRY_API_URL || 'https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod';
    
    const response = await fetch(`${apiUrl}/ledger`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[ledger] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch ledger entries', entries: [] },
      { status: 500 }
    );
  }
}
