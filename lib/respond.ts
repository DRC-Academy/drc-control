// Opcional: con RESPONDIO_TOKEN, los contactos que hoy están en la etapa Alumno cuentan como venta en el embudo.
import "server-only";
import { unstable_cache } from "next/cache";
import type { EstadoRespond } from "./sinVentas";

type Respuesta = { items?: { id: number | string }[]; data?: { id: number | string }[]; pagination?: { next?: string } };

async function cargarAlumnos(): Promise<number[]> {
  const t = process.env.RESPONDIO_TOKEN;
  if (!t) return [];
  const ids: number[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 80; i++) {
    const url = new URL("https://api.respond.io/v2/contact/list");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursorId", cursor);
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, Accept: "application/json", "Content-Type": "application/json", "User-Agent": "drc-control" },
      body: JSON.stringify({
        search: "",
        timezone: "Europe/Madrid",
        filter: { $and: [{ category: "lifecycle", field: null, operator: "isEqualTo", value: "Alumno" }] },
      }),
      cache: "no-store",
    });
    // lo que lanza una funcion de unstable_cache no se guarda: un fallo de Respond no deja una lista vacia en cache una hora
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = (await r.json()) as Respuesta;
    const items = j.items || j.data || [];
    items.forEach((c) => { const n = Number(c.id); if (n) ids.push(n); });
    const nxt = j.pagination?.next;
    if (!nxt || !items.length) break;
    cursor = nxt.startsWith("http") ? new URL(nxt).searchParams.get("cursorId") : nxt;
    if (!cursor) break;
  }
  return ids;
}

// La clave lleva v2 porque la v1 guardo una lista vacia durante una hora cuando aun no estaba puesto el token (16/10/2026).
const alumnosEnCache = unstable_cache(cargarAlumnos, ["alumnos", "v2"], { revalidate: 3600, tags: ["alumnos"] });

/** Los alumnos de Respond y por que, si no hay, no los hay. Sin token o con un fallo no se guarda nada en cache. */
export async function leerAlumnos(): Promise<{ ids: number[]; estado: EstadoRespond }> {
  if (!process.env.RESPONDIO_TOKEN) return { ids: [], estado: { token: false, error: null } };
  try {
    return { ids: await alumnosEnCache(), estado: { token: true, error: null } };
  } catch (e) {
    return { ids: [], estado: { token: true, error: (e as Error).message.slice(0, 80) } };
  }
}
