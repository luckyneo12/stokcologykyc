import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  let targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('URL is required', { status: 400 });
  }

  // Bypass proxy for localhost to avoid Node fetch ECONNREFUSED issues
  if (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1')) {
    return NextResponse.redirect(targetUrl);
  }

  try {
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      return new NextResponse('Failed to fetch document', { status: response.status });
    }
    
    const arrayBuffer = await response.arrayBuffer();

    // Optional ?name= lets the browser's built-in PDF viewer save with a meaningful file name
    const safeName = String(searchParams.get('name') || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': safeName ? `inline; filename="${safeName}.pdf"` : 'inline',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('PDF Proxy Error:', error);
    return new NextResponse('Error fetching document', { status: 500 });
  }
}
