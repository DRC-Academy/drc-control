import { cargar } from "@/lib/cargar";
import { stats, sig, usoDiario, FASES, EMBUDO_N, maxFecha } from "@/lib/analisis";
import { f0, p0, p1, fmtDia, addDias } from "@/lib/formato";
import Chip from "@/components/Chip";
import Grafica from "@/components/Grafica";
import Pildoras from "@/components/Pildoras";
import Aviso from "@/components/Aviso";

export const dynamic = "force-dynamic";

const esFecha = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function Comparar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { filas, alumnos, panel, error } = await cargar();
  const max = maxFecha(filas);
  const preset = sp.preset === "mes" || sp.preset === "cus" ? sp.preset : "sem";
  let a1 = "", a2 = "", b1 = "", b2 = "";
  if (preset === "cus" && esFecha(sp.a1) && esFecha(sp.a2) && esFecha(sp.b1) && esFecha(sp.b2)) { a1 = sp.a1; a2 = sp.a2; b1 = sp.b1; b2 = sp.b2; }
  else if (max) { const d = preset === "mes" ? 30 : 7; a1 = addDias(max, -(d - 1)); a2 = max; b1 = addDias(max, -(2 * d - 1)); b2 = addDias(max, -d); }
  const A = max ? stats(filas, a1, a2, alumnos) : null, B = max ? stats(filas, b1, b2, alumnos) : null;
  const rng = (x: string, y: string) => fmtDia(x) + " a " + fmtDia(y);
  type Clave = "uso" | "valida" | "error" | "corr" | "lat" | "contactos" | "conv";
  const M: [string, (s: NonNullable<typeof A>) => string, Clave, number, boolean][] = [
    ["La persona usa lo que propone el bot", (s) => p0(s.uso), "uso", 1, true],
    ["Escribe otra respuesta (correcta)", (s) => p0(s.valida), "valida", -1, true],
    ["Responde con un error", (s) => p0(s.error), "error", -1, true],
    ["Veces que el equipo corrige al bot (por 100)", (s) => s.corr.toFixed(0), "corr", -1, false],
    ["Segundos que tarda el bot en proponer", (s) => Math.round(s.lat) + " s", "lat", -1, false],
    ["Personas nuevas en el embudo", (s) => f0(s.contactos), "contactos", 1, false],
    ["Ventas de esas personas", (s) => s.ventas + " (" + p1(s.conv) + ")", "conv", 1, true],
  ];
  const tendencia = usoDiario(filas);
  let worstI = -1, wl = -1;
  if (A) for (let i = 1; i < 5; i++) { const lo = A.reach[i - 1] ? (A.reach[i - 1] - A.reach[i]) / A.reach[i - 1] : 0; if (lo > wl) { wl = lo; worstI = i; } }
  return (
    <>
      <Pildoras control={panel.control} aplicado={panel.aplicado} sha={panel.sha} maxFecha={max} />
      {error && <Aviso tono="mal" texto={"No se han podido leer las métricas del bot: " + error} />}
      {!alumnos.size && <Aviso tono="aviso" texto="Sin RESPONDIO_TOKEN en Vercel las ventas salen a 0: la app no puede saber qué contactos son hoy alumnos." />}
      <div className="tarjeta">
        <div><h2>Qué periodos comparar</h2></div>
        <form method="get" className="ctl">
          <label>Comparación
            <select name="preset" defaultValue={preset}>
              <option value="sem">Últimos 7 días contra los 7 anteriores</option><option value="mes">Últimos 30 días contra los 30 anteriores</option><option value="cus">Personalizada</option>
            </select>
          </label>
          <label>Periodo actual, desde<input type="date" name="a1" defaultValue={a1} /></label>
          <label>hasta<input type="date" name="a2" defaultValue={a2} /></label>
          <label>Periodo anterior, desde<input type="date" name="b1" defaultValue={b1} /></label>
          <label>hasta<input type="date" name="b2" defaultValue={b2} /></label>
          <button type="submit">Comparar</button>
        </form>
        <p className="nota">{max ? "Datos hasta el " + fmtDia(max) + " · actual: " + rng(a1, a2) + " · anterior: " + rng(b1, b2) + ". Para fechas propias, elige Personalizada y rellena las cuatro." : "Sin datos."}</p>
      </div>
      {A && B && (
        <>
          <div className="tarjeta">
            <div><h2>Qué va mejor y qué va peor</h2><p className="nota">Verde = va mejor. Rojo = va peor. "No concluyente" = puede ser casualidad.</p></div>
            <div className="cmp">
              <div className="h">Métrica</div><div className="h n">Anterior</div><div className="h n">Actual</div><div className="h">Cambio</div>
              {M.map(([lb, f, k, good, prop]) => {
                const vacio = B.n === 0;
                const d = A[k] - B[k];
                let chip: React.ReactNode;
                if ((vacio && B.contactos === 0) || (k === "conv" && B.contactos === 0) || (vacio && k !== "contactos" && k !== "conv")) chip = <span className="nota">Sin periodo anterior</span>;
                else {
                  const unit = k === "lat" ? " s" : k === "corr" || k === "contactos" ? "" : " pts";
                  const val = k === "lat" || k === "corr" || k === "contactos" ? d : d * 100;
                  const s = prop ? (k === "conv" ? sig(A.conv, A.contactos, B.conv, B.contactos) : sig(A[k], A.n, B[k], B.n)) : Math.min(A.n, B.n) < 30 ? "pequeña" : "no concluyente";
                  const dir = Math.abs(val) < 0.05 ? 0 : (d > 0 ? 1 : -1) * good;
                  chip = <Chip texto={(val > 0 ? "+" : "") + val.toFixed(k === "contactos" || k === "lat" || k === "corr" ? 0 : 1) + unit + " · " + s} tono={s === "clara" ? (dir > 0 ? "ok" : dir < 0 ? "mal" : "") : ""} />;
                }
                return (
                  <div key={k} style={{ display: "contents" }}>
                    <div>{lb}</div><div className="n big">{vacio && k !== "contactos" && k !== "conv" ? "—" : f(B)}</div><div className="n big">{f(A)}</div><div>{chip}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="tarjeta">
            <div><h2>Dónde se pierde la gente</h2><p className="nota">Cuánta gente llega a cada paso. Barra gruesa = periodo actual, fina = anterior. En rojo, la mayor fuga.</p></div>
            <div className="leyenda"><span><i className="sw gris" />Periodo anterior</span><span><i className="sw" />Periodo actual</span><span><i className="sw ok" />Venta</span></div>
            <div className="barras">
              {[...EMBUDO_N.map((n, i) => [n, A.reach[i], B.reach[i]] as [string, number, number]), ["Alumno (venta)", A.ventas, B.ventas] as [string, number, number]].map(([nm, a, b], i, arr) => {
                const tA = A.reach[0] || 1, tB = B.reach[0] || 1, last = i === arr.length - 1;
                return (
                  <div className="pr" key={nm} style={{ gridTemplateColumns: "minmax(8rem,10rem) 1fr minmax(6rem,9rem)" }}>
                    <div style={i === worstI ? { color: "var(--mal)", fontWeight: 600 } : undefined}>{nm}</div>
                    <div className="pb">
                      <i className="gris" style={{ height: 6, width: Math.max((b / tB) * 100, 0.5) + "%" }} />
                      <i className={i === worstI ? "mal" : last ? "ok" : ""} style={{ height: 16, width: Math.max((a / tA) * 100, 0.5) + "%" }} />
                    </div>
                    <div className="tr">{f0(a)} ({p0(a / tA)}){i === worstI ? " · mayor fuga" : ""}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="tarjeta">
            <div><h2>Dónde la persona no hace caso al bot</h2><p className="nota">Cuántas veces la persona envía lo que propone el bot. Más largo = mejor. Atenuado: pocos datos.</p></div>
            <div className="leyenda"><span><i className="sw gris" />Periodo anterior</span><span><i className="sw" />Periodo actual</span></div>
            <div className="barras">
              {FASES.map(([k, nm]) => {
                const a = A.fase[k], b = B.fase[k];
                return (
                  <div className="pr" key={k}>
                    <div>{nm}</div>
                    <div className="pb" style={a.n < 30 || b.n < 30 ? { opacity: 0.45 } : undefined}>
                      <i className="gris" style={{ width: Math.max(b.uso * 100, 0.5) + "%" }} />
                      <i style={{ width: Math.max(a.uso * 100, 0.5) + "%" }} />
                    </div>
                    <div className="tr">{b.n ? p0(a.uso) + " (antes " + p0(b.uso) + ")" : p0(a.uso) + " · n " + a.n}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      <div className="tarjeta">
        <div><h2>Uso tal cual, por día</h2><p className="nota">Solo días con 20 propuestas evaluadas o más.</p></div>
        <Grafica etiqueta="Uso tal cual" alto={230} dominio={[0, 1]} fmt="pct" xfmt="dia" puntos={tendencia.map((r) => ({ x: r.dia, y: r.uso, detalle: [["Uso tal cual", p0(r.uso)], ["Propuestas", f0(r.n)]] }))} />
      </div>
    </>
  );
}
