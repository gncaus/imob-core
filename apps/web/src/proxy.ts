import { type NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'imob_session';

/**
 * Redireciona para o login quem não tem cookie de sessão. A validade do token é conferida pela
 * API em cada chamada; aqui é só para não renderizar o painel para quem nunca entrou.
 *
 * O caminho inverso (quem tem cookie e abre /login ir para o painel) não é feito aqui: o cookie
 * pode existir e estar inválido (expirado, usuário removido), e isso criaria um loop entre o
 * login e o painel. A tela de login sempre abre.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isLogin = request.nextUrl.pathname === '/login';

  if (!hasSession && !isLogin) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Tudo menos a API (proxiada), arquivos do Next e estáticos.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
