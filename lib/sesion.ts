// Sesion firmada en una cookie. Sin base de datos: la firma sale de las claves de acceso.
// Compatible con el runtime Edge (middleware): solo Web Crypto.

export type Rol = "mandos" | "vista";
export type Sesion = { rol: Rol; exp: number };

const enc = new TextEncoder();

function buf(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

function b64url(datos: ArrayBuffer | Uint8Array): string {
  const b = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deB64url(s: string): Uint8Array {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function claveFirma(): Promise<CryptoKey | null> {
  const m = process.env.CLAVE_MANDOS || "";
  const v = process.env.CLAVE_VISTA || "";
  if (!m && !v) return null;
  const raw = await crypto.subtle.digest("SHA-256", buf(enc.encode("drc-control|" + m + "|" + v)));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function firmarSesion(rol: Rol, dias = 30): Promise<string | null> {
  const k = await claveFirma();
  if (!k) return null;
  const cuerpo = b64url(enc.encode(JSON.stringify({ rol, exp: Date.now() + dias * 864e5 })));
  const firma = b64url(await crypto.subtle.sign("HMAC", k, buf(enc.encode(cuerpo))));
  return cuerpo + "." + firma;
}

export async function verificarSesion(token?: string): Promise<Sesion | null> {
  if (!token) return null;
  const [cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma) return null;
  const k = await claveFirma();
  if (!k) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", k, buf(deB64url(firma)), buf(enc.encode(cuerpo)));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(deB64url(cuerpo))) as Sesion;
    if (!s || typeof s.exp !== "number" || s.exp < Date.now()) return null;
    if (s.rol !== "mandos" && s.rol !== "vista") return null;
    return s;
  } catch {
    return null;
  }
}

function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function rolDeClave(clave: string): Rol | null {
  const m = process.env.CLAVE_MANDOS;
  const v = process.env.CLAVE_VISTA;
  if (!clave) return null;
  if (m && igual(clave, m)) return "mandos";
  if (v && igual(clave, v)) return "vista";
  return null;
}
