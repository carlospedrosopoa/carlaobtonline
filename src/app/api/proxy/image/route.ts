import { NextRequest, NextResponse } from 'next/server';

function isAllowedRemoteUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return false;

    const allowedHosts = new Set(['storage.googleapis.com']);
    if (!allowedHosts.has(url.hostname)) return false;

    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get('url');

    if (!rawUrl) {
      return NextResponse.json({ mensagem: 'url é obrigatório' }, { status: 400 });
    }

    if (!isAllowedRemoteUrl(rawUrl)) {
      return NextResponse.json({ mensagem: 'url não permitida' }, { status: 400 });
    }

    const upstream = await fetch(rawUrl, {
      method: 'GET',
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5',
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { mensagem: 'Falha ao buscar imagem', status: upstream.status },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { mensagem: 'Erro ao buscar imagem', error: error?.message },
      { status: 500 }
    );
  }
}

