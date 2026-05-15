import { NextRequest, NextResponse } from "next/server"

const ROOT_DOMAIN = "foroinmobiliario.com.ar"

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || ""
  const url = req.nextUrl.clone()

  // Extrae el subdominio: mat105.foroinmobiliario.com.ar → "mat105"
  const isRootDomain = host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`

  // Solo tratar como subdominio de corredor si es *.foroinmobiliario.com.ar
  // Las URLs de preview de Vercel (*.vercel.app) NO son subdominios de corredores
  const isSubdomain =
    !isRootDomain && host.endsWith(`.${ROOT_DOMAIN}`)

  if (!isSubdomain) return NextResponse.next()

  // Extrae el slug del subdominio
  const subdomain = host.split(".")[0]

  // Ignora subdominios internos de Vercel / sistema
  if (["www", "api", "admin", "vercel"].includes(subdomain)) return NextResponse.next()

  // Si ya está en /web/..., no reescribir (evita loop)
  if (url.pathname.startsWith("/web/")) return NextResponse.next()

  // No reescribir rutas de API (accesibles desde cualquier subdominio/preview)
  if (url.pathname.startsWith("/api/")) return NextResponse.next()

  // Rewrite: mat105.foroinmobiliario.com.ar/propiedades → /web/mat105/propiedades
  const newPath = `/web/${subdomain}${url.pathname}`
  url.pathname = newPath

  return NextResponse.rewrite(url)
}

export const config = {
  matcher: [
    // Aplica a todas las rutas excepto archivos estáticos y _next
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)).*)",
  ],
}
