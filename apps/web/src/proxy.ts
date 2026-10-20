import { type NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'imob_session';

/**
 * Redireciona para o login quem não tem cookie de sessão. A validade do token é conferida pela
 * API em cada chamada; aqui é só para não renderizar o painel para quem nunca entrou.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isLogin = request.nextUrl.pathname === '/login';

  if (!hasSession && !isLogin) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && isLogin) return NextResponse.redirect(new URL('/imoveis', request.url));
  return NextResponse.next();
}

export const config = {
  // Tudo menos a API (proxiada), arquivos do Next e estáticos.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
