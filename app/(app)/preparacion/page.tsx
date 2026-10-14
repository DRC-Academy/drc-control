import { cargar } from "@/lib/cargar";
import { fases, hastaDonde, usoSemanal, FASES, NOMBRE, UMBRAL, maxFecha } from "@/lib/analisis";
import { f0, f1, p0, fmtDia, pts } from "@/lib/formato";
import BarraH from "@/components/BarraH";
import Grafica from "@/components/Grafica";
import Pildoras from "@/components/Pildoras";
import Aviso from "@/components/Aviso";

export const dynamic = "force-dynamic";

export default async function Preparacion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ventana = [7, 14, 30].includes(Number(sp.ventana)) ? Number(sp.ventana) : 14;
  const { filas, panel, error } = await cargar();
  const rows = fases(filas, ventana);
  const u = hastaDonde(rows);
  const orden = ["cualificacion", "explicacion", "precio"];
  const sig: string = u ? orden[orden.indexOf(u) + 1] ?? "" : "cualificacion";
  const rs = sig ? rows.find((x) => x.fase === sig) : undefined;
  let veredicto = rows.length ? (u ? "Con los últimos " + ventana + " días, el bot cumple los tres criterios hasta " + NOMBRE[u].toLowerCase() + "." : "Con los últimos " + ventana + " días, ninguna fase cumple los tres criterios todavía.") : "Sin datos.";
  if (rs) {
    const faltan: string[] = [];
    if (rs.n < UMBRAL.n) faltan.push("faltan propuestas (" + rs.n + " de " + UMBRAL.n + ")");
    if (rs.uso != null && rs.uso < UMBRAL.uso) faltan.push("el uso es del " + p0(rs.uso) + " (mínimo 85 %)");
    if (rs.corr100 != null && rs.corr100 > UMBRAL.corr) faltan.push("hay " + f1(rs.corr100) + " correcciones por 100 (máximo 3)");
    veredicto += " En " + NOMBRE[sig].toLowerCase() + (faltan.length ? ": " + faltan.join(", ") + "." : " cumple también.");
  }
  const V = (v: string) => (v === "lista" ? "Lista" : v === "casi" ? "Casi" : "No");
  return (
    <>
      <Pildoras control={panel.control} aplicado={panel.aplicado} sha={panel.sha} maxFecha={maxFecha(filas)} />
      {error && <Aviso tono="mal" texto={"No se han podido leer las métricas del bot: " + error} />}
      <div className="tarjeta">
        <form method="get" className="ctl">
          <label>Ventana de datos
            <select name="ventana" defaultValue={String(ventana)}>
              <option value="7">Últimos 7 días</option><option value="14">Últimos 14 días</option><option value="30">Últimos 30 días</option>
            </select>
          </label>
          <button type="submit">Ver</button>
        </form>
        <p className="nota">Una fase está <b>lista</b> para que el bot responda solo cuando, en la ventana elegida, se cumplen las tres: el equipo envía la propuesta tal cual (o casi) al menos el 85 % de las veces, corrige al bot 3 veces o menos por cada 100 propuestas, y hay al menos 100 propuestas. <b>Casi</b>: cumple dos. Los errores del humano no cuentan aquí: miden a la persona, no al bot.</p>
      </div>
      <div className="tarjeta">
        <div><h2>Hasta dónde puede responder solo el bot</h2><p className="sub">{veredicto}</p></div>
        <div className="leyenda"><span><i className="sw ok" />Lista</span><span><i className="sw casi" />Casi</span><span><i className="sw mal" />No</span><span>Línea discontinua: 85 % de uso</span></div>
        <BarraH umbral={UMBRAL.uso} filas={rows.map((r) => ({ etiqueta: r.nombre, valor: r.uso, texto: r.uso != null ? p0(r.uso) + " · n " + r.n : "sin datos", clase: r.veredicto === "lista" ? "ok" : r.veredicto === "casi" ? "casi" : "mal" }))} />
      </div>
      <div className="tarjeta">
        <div><h2>Detalle por fase</h2><p className="nota">Uso tal cual = usada o equivalente entre las evaluadas. Correcciones por 100 = veces que el equipo corrigió al bot por cada 100 evaluadas. Errores del humano por 100 = respuestas de la persona con un fallo claro, según el árbitro. Cambio = puntos de uso frente a la ventana anterior.</p></div>
        <div className="tw">
          <table>
            <thead><tr><th>Fase</th><th>Veredicto</th><th>Evaluadas</th><th>Uso tal cual</th><th>Correcciones por 100</th><th>Errores del humano por 100</th><th>Uso ventana anterior</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.fase}>
                  <td>{r.nombre}</td><td>{V(r.veredicto)}</td><td>{f0(r.n)}</td><td>{p0(r.uso)}</td><td>{f1(r.corr100)}</td><td>{f1(r.err100)}</td>
                  <td>{r.uso_ant != null ? p0(r.uso_ant) + (r.uso != null ? " (" + pts((r.uso - r.uso_ant) * 100) + ")" : "") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="tarjeta">
        <div><h2>Evolución semanal del uso tal cual</h2><p className="nota">Una gráfica por fase, misma escala de 0 a 100 %. Semanas de lunes a domingo; solo semanas con 20 propuestas evaluadas o más en esa fase. Línea discontinua: 85 %.</p></div>
        <div className="sm">
          {FASES.map(([k, nm]) => {
            const g = usoSemanal(filas, k);
            return (
              <div className="tarjeta" key={k}>
                <h3>{nm}</h3>
                <Grafica etiqueta="Uso tal cual" alto={120} dominio={[0, 1]} fmt="pct" xfmt="semana" referencia={{ v: UMBRAL.uso }}
                  puntos={g.map((r) => ({ x: r.semana, y: r.uso, detalle: [["Uso tal cual", p0(r.uso)], ["Evaluadas", f0(r.n)]] }))} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
