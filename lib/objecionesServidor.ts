// Lectura de las objeciones clasificadas por el bot (rama estado, objeciones/AAAA-MM-DD.jsonl). Solo servidor.
// Cada archivo se cachea por su sha (los días pasados no cambian); la lista del directorio, 5 minutos.
import "server-only";
import { unstable_cache } from "next/cache";
import { listarDir, leerTexto } from "./github";
import { addDias, hoyIso } from "./formato";
import type { FilaObj } from "./objeciones";

export const DIAS_OBJECIONES = 60;

const listar = unstable_cache(async () => listarDir("objeciones"), ["objeciones-dir"], { revalidate: 300, tags: ["objeciones"] });

function texto(v: unknown): string {
  return v == null ? "" : String(v);
}
function normalizar(r: Record<string, unknown>): FilaObj | null {
  const sigue = texto(r.sigue);
  if (!r.cid || !r.objecion) return null;
  return {
    fecha: texto(r.fecha).slice(0, 10), cid: Number(r.cid) || 0, id: Number(r.id) || 0, etapa: texto(r.etapa),
    objecion: texto(r.objecion), indicado: texto(r.indicado), propuesto: texto(r.propuesto),
    sigue: sigue === "si" || sigue === "parcial" || sigue === "no" ? sigue : "no",
    motivo: r.motivo ? texto(r.motivo) : undefined, barra: texto(r.barra), estado: texto(r.estado), grupo: r.grupo ? texto(r.grupo) : undefined,
  };
}

function leerArchivo(name: string, sha: string): Promise<FilaObj[]> {
  return unstable_cache(
    async () => {
      const t = await leerTexto("objeciones/" + name);
      const out: FilaObj[] = [];
      (t || "").split("\n").forEach((l) => {
        const s = l.trim();
        if (!s) return;
        try {
          const f = normalizar(JSON.parse(s) as Record<string, unknown>);
          if (f) out.push(f);
        } catch {
          /* línea rota: se ignora */
        }
      });
      return out;
    },
    ["objeciones-archivo", name, sha],
    { revalidate: 86400, tags: ["objeciones"] },
  )();
}

/** Las propuestas clasificadas de los últimos 60 días. Vacío si el bot todavía no ha clasificado nada. */
export async function leerObjeciones(): Promise<FilaObj[]> {
  const dir = await listar();
  const desde = addDias(hoyIso(), -DIAS_OBJECIONES);
  const sel = dir.filter((a) => a.name.endsWith(".jsonl") && a.name.slice(0, 10) >= desde).sort((a, b) => (a.name < b.name ? -1 : 1));
  const partes: FilaObj[][] = [];
  for (let i = 0; i < sel.length; i += 8) {
    partes.push(...(await Promise.all(sel.slice(i, i + 8).map((a) => leerArchivo(a.name, a.sha)))));
  }
  return partes.flat();
}
