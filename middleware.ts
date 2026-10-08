import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from './src/lib/database.types'
import { isAuthEnabled } from './src/lib/auth-mode'

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/signup',
  '/contrato/acesso',
  '/templates/orcamento/acesso',
  '/api/public-access',
]

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public') ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|json)$/i.test(pathname)
  )
}

function isPublicPath(pathname: string): boolean {
  return pathname === '/' || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  if (!isAuthEnabled()) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
