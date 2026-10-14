import type { Control, Aplicado } from "@/lib/control";
import { programada } from "@/lib/control";
import { NOMBRE } from "@/lib/analisis";
import { fmtDia } from "@/lib/formato";

function normal(c: Control | Aplicado | null): string {
  if (!c || !("modo" in c)) return "";
  const x = c as Control;
  return JSON.stringify({ modo: x.modo, fase_tope: x.fase_tope, grupo_pct: x.grupo_pct, programacion: x.programacion, reglas: x.reglas });
}

export default function Pildoras({ control, aplicado, sha, maxFecha }: { control: Control | null; aplicado: Aplicado | null; sha: string | null; maxFecha: string }) {
  const c = control;
  const ahora = new Date();
  const items: { t: string; cls: string }[] = [];
  if (c) {
    items.push({
      t: c.modo === "autonomo" ? "Modo: responde solo al " + (c.grupo_pct ?? 0) + " % de leads nuevos hasta " + (NOMBRE[c.fase_tope] || "").toLowerCase()
        : c.modo === "apagado" ? "Modo: apagado" : "Modo: propone, una persona envía",
      cls: c.modo === "apagado" ? "mal" : "ok",
    });
    if (c.modo === "autonomo") { const pa = programada(c, ahora); items.push({ t: "Modo autónomo ahora: " + (pa.activo ? "activo, " + pa.motivo : "inactivo, " + pa.motivo), cls: pa.activo ? "ok" : "" }); }
    const leido = aplicado && sha && aplicado.sha === sha;
    items.push({ t: leido ? "Leído por el bot" : "Pendiente: el bot aún no ha leído esta versión", cls: leido ? "ok" : "aviso" });
    void normal;
  } else {
    items.push({ t: "Sin control.json: el bot funciona en modo propone", cls: "" });
  }
  if (maxFecha) items.push({ t: "Datos hasta el " + fmtDia(maxFecha), cls: "" });
  return (
    <div className="pildoras">
      {items.map((p) => <span key={p.t} className={"pildora " + p.cls}><i />{p.t}</span>)}
    </div>
  );
}
