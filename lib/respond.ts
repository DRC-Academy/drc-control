// Opcional: con RESPONDIO_TOKEN, los contactos que hoy están en la etapa Alumno cuentan como venta en el embudo.
import "server-only";
import { unstable_cache } from "next/cache";

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
    if (!r.ok) break;
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

export const leerAlumnos = unstable_cache(cargarAlumnos, ["alumnos"], { revalidate: 3600, tags: ["alumnos"] });
