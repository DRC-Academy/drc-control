import { cargar } from "@/lib/cargar";
import { motivoSinVentas } from "@/lib/sinVentas";
import { grupos, periodos, stats, NOMBRE, maxFecha } from "@/lib/analisis";
import { CONTROL_DEFECTO, describeProg } from "@/lib/control";
import { f0, f1, p0, p1, fmtFecha, addDias } from "@/lib/formato";
import Pildoras from "@/components/Pildoras";
import Aviso from "@/components/Aviso";

export const dynamic = "force-dynamic";

export default async function Grupo() {
  const { filas, alumnos, respond, panel, error } = await cargar();
  const c = panel.control || CONTROL_DEFECTO;
  const max = maxFecha(filas);
  const [A] = periodos(filas);
  const G = grupos(filas, alumnos);
  const bot = G.find((g) => g.grupo === "bot"), ctl = G.find((g) => g.grupo === "control");
  let tamano = "Sin datos.";
  if (A && max) {
    const pct = c.grupo_pct ?? 0, ld = A.leads_dia, al = (ld * pct) / 100;
    const S = stats(filas, addDias(max, -27), max, alumnos);
    const base = S.reach[0] ? S.reach[2] / S.reach[0] : 0.5;
    const p2 = Math.min(base + 0.1, 0.99);
    const n = Math.ceil((7.84 * (base * (1 - base) + p2 * (1 - p2))) / 0.01);
    const dias = al > 0 ? Math.ceil(n / al) : null;
    tamano = "Entran unos " + f1(ld) + " leads nuevos al día. Con el " + pct + " % en el grupo, el bot contestaría a unos " + f1(al) + " al día. Hoy el " + p0(base) + " de los leads llegan al precio: para ver una diferencia de 10 puntos hacen falta unos " + f0(n) + " leads en cada grupo, es decir, " + (dias ? (dias > 60 ? "unas " + Math.round(dias / 7) + " semanas" : dias + " días") : "ningún lead mientras el grupo esté al 0 %") + ".";
  }
  const ic = (d: number, lo: number, hi: number) => (lo > 0 ? "El bot lo hace mejor." : hi < 0 ? "La persona lo hace mejor." : "Todavía no se puede distinguir.");
  let dif = "";
  if (bot && ctl && bot.llegan_precio != null && ctl.llegan_precio != null && bot.contactos && ctl.contactos) {
    const d = bot.llegan_precio - ctl.llegan_precio;
    const se = Math.sqrt((bot.llegan_precio * (1 - bot.llegan_precio)) / bot.contactos + (ctl.llegan_precio * (1 - ctl.llegan_precio)) / ctl.contactos);
    const lo = d - 1.96 * se, hi = d + 1.96 * se;
    dif = "Llegan al precio: " + (d >= 0 ? "+" : "") + (d * 100).toFixed(0) + " puntos con el bot (intervalo del 95 %: " + (lo * 100).toFixed(0) + " a " + (hi * 100).toFixed(0) + "). " + ic(d, lo, hi);
  }
  const F = [
    ["Leads", (g: typeof G[number]) => f0(g.contactos)],
    ["Llegan al precio", (g: typeof G[number]) => p0(g.llegan_precio)],
    ["Contestados en menos de 10 min", (g: typeof G[number]) => p0(g.pct_10min)],
    ["Ventas", (g: typeof G[number]) => f0(g.ventas) + " (" + p1(g.conv) + ")"],
    ["Errores y correcciones", (g: typeof G[number]) => f0(g.errores)],
    ["Traspasos a persona", (g: typeof G[number]) => f0(g.traspasos) + " (pregunta si es IA " + f0(g.traspasos_ia) + ", fase tope " + f0(g.traspasos_fase) + ", otros " + f0(g.traspasos_otros) + ")"],
  ] as const;
  return (
    <>
      <Pildoras control={panel.control} aplicado={panel.aplicado} sha={panel.sha} maxFecha={max} />
      {error && <Aviso tono="mal" texto={"No se han podido leer las métricas del bot: " + error} />}
      <div className="tarjeta">
        <div><h2>Cómo está configurado el grupo de control</h2><p className="nota">Se cambia en el panel de control. El grupo lo forman solo leads nuevos que entran mientras el modo autónomo está activo; a cada lead le toca por sorteo fijo (según su id), así nadie elige quién entra.</p></div>
        <div className="kv">
          <span>Modo</span><span>{c.modo === "autonomo" ? "Responde solo al grupo de control" : c.modo === "apagado" ? "Apagado" : "Propone (una persona envía)"}</span>
          <span>Fase tope</span><span>{NOMBRE[c.fase_tope] || c.fase_tope}</span>
          <span>Grupo de control</span><span>{(c.grupo_pct ?? 0) + " % de los leads nuevos"}</span>
          <span>Desde</span><span>{c.autonomo_desde ? fmtFecha(c.autonomo_desde) : "Todavía no activado"}</span>
          <span>Programación</span><span>{describeProg(c)}</span>
        </div>
      </div>
      <div className="tarjeta">
        <div><h2>Cuántos leads entrarían y cuánto tardaríamos en saber algo</h2></div>
        <p className="sub">{tamano}</p>
        <p className="nota">La cuenta de leads sale de los contactos nuevos de ventas de los últimos 7 días. La estimación usa la fase a la que hoy llega cada lead y busca ver una diferencia de 10 puntos en "llegan al precio" con una confianza del 95 %. Con pocos leads en el grupo el resultado tarda meses: mejor un porcentaje alto y pocas semanas que al revés.</p>
      </div>
      <div className="tarjeta">
        <div><h2>Resultados: bot solo frente a persona</h2><p className="nota">Se rellena cuando el modo autónomo esté activo y el bot marque cada lead con su grupo. {alumnos.size ? "" : "Las ventas salen a 0: " + motivoSinVentas(respond)}</p></div>
        {!G.length ? <p className="nota">Sin datos todavía: el bot aún no marca leads con grupo. Empieza cuando el modo autónomo se active y el bot lo aplique.</p> : (
          <>
            <table>
              <thead><tr><th>Métrica</th><th>Le contesta el bot</th><th>Le contesta una persona</th></tr></thead>
              <tbody>{F.map(([k, f]) => <tr key={k}><td>{k}</td><td>{bot ? f(bot) : "—"}</td><td>{ctl ? f(ctl) : "—"}</td></tr>)}</tbody>
            </table>
            {dif && <p className="sub">{dif}</p>}
          </>
        )}
      </div>
    </>
  );
}
