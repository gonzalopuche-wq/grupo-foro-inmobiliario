import { NextRequest, NextResponse } from "next/server"

const ROOT_DOMAIN = "foroinmobiliario.com.ar"

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") || ""
  const url = req.nextUrl.clone()

  const isRootDomain = host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`

  // Solo tratar como subdominio de corredor si es *.foroinmobiliario.com.ar
  // Las URLs de preview de Vercel (*.vercel.app) NO son subdominios de corredores
  const isSubdomain = !isRootDomain && host.endsWith(`.${ROOT_DOMAIN}`)

  if (!isSubdomain) return NextResponse.next()

  const subdomain = host.split(".")[0]

  if (["www", "api", "admin", "vercel"].includes(subdomain)) return NextResponse.next()

  if (url.pathname.startsWith("/web/")) return NextResponse.next()
  if (url.pathname.startsWith("/api/")) return NextResponse.next()

  // Rewrite: mat105.foroinmobiliario.com.ar/propiedades → /web/mat105/propiedades
  url.pathname = `/web/${subdomain}${url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)).*)",
  ],
}
