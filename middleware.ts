import { NextRequest, NextResponse } from "next/server";

// Auth propia delante del hub (CONTEXT_BASE.md sección 11): sin esto,
// cualquiera con la URL pública podría pegarle a las API routes y quemar
// las keys de los proveedores de IA. Basic Auth es suficiente para un hub
// de uso personal — el navegador (incluido Safari iOS) maneja el prompt
// nativamente, sin necesidad de pantalla de login propia.
export function middleware(req: NextRequest) {
  const expected = process.env.HUB_ACCESS_PASSWORD;

  // Si no hay password configurada, no bloqueamos (evita dejar el hub
  // inutilizable por un env var faltante) — pero conviene configurarla.
  if (!expected) {
    return NextResponse.next();
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const encoded = authHeader.split(" ")[1];
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(":");
    const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";
    if (password === expected) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Autenticación requerida.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SPK_MultiDev"' },
  });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
