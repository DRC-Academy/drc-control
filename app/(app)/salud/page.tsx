import { cargar } from "@/lib/cargar";
import { porDia, periodos, fases, hastaDonde, LIM, NOMBRE, maxFecha } from "@/lib/analisis";
import { f0, f1, p0, fmtDia, pts } from "@/lib/formato";
import Kpi from "@/components/Kpi";
import Grafica from "@/components/Grafica";
import Pildoras from "@/components/Pildoras";
import Aviso from "@/components/Aviso";
import { refrescar } from "@/app/acciones";

export const dynamic = "force-dynamic";

export default async function Salud() {
  const { filas, panel, error } = await cargar();
  const dias = porDia(filas);
  const [A, B] = periodos(filas);
  const max = maxFecha(filas);
  const f7 = fases(filas, 7);
  const u = hastaDonde(f7);
  const fase = (k: string) => f7.find((r) => r.fase === k);

  let titular = "Sin datos todavía.";
  if (A && f7.length) {
    const partes = ["cualificacion", "explicacion", "precio"].map((k) => { const r = fase(k); return r && r.uso != null ? NOMBRE[k].toLowerCase() + " " + p0(r.uso) : null; }).filter(Boolean);
    const obj = fase("objecion");
    titular = "Últimos 7 días (del " + fmtDia(A.desde) + " al " + fmtDia(A.hasta) + "): el equipo envía la propuesta del bot tal cual en " + partes.join(", ") +
      (obj && obj.uso != null ? "; en objeción baja al " + p0(obj.uso) : "") + ". " +
      (u ? "Hasta " + NOMBRE[u].toLowerCase() + " el bot cumple los tres criterios para responder solo." : "Ninguna fase cumple todavía los tres criterios para responder solo.") +
      (A.resp_med_min != null ? " Una persona tarda " + f1(A.resp_med_min) + " minutos (mediana) en enviar la respuesta; el límite es 10." : "");
  }

  const fallos: string[] = [];
  if (A) {
    if (A.resp_med_min != null && A.resp_med_min > LIM.resp_min) fallos.push("Una persona tarda " + f1(A.resp_med_min) + " minutos en contestar (mediana); el límite es " + LIM.resp_min + ".");
    if (A.pct_10min != null && A.pct_10min < 0.5) fallos.push("Solo el " + p0(A.pct_10min) + " de las propuestas se contestan en menos de 10 minutos.");
    if (A.lat_med_s != null && A.lat_med_s > LIM.lat_s) fallos.push("El bot tarda " + Math.round(A.lat_med_s) + " s en proponer (mediana); el objetivo es " + LIM.lat_s + " s.");
    if (A.sin_respuesta > 0) fallos.push(A.sin_respuesta + " propuestas se quedaron sin respuesta humana (caducadas o sin humano).");
    if (A.pct_barrido > LIM.barrido) fallos.push("El " + p0(A.pct_barrido) + " de las propuestas llegaron por barrido: el relevo de Respond a GitHub está fallando.");
  }
  const delta = (k: "por_dia" | "pct_10min" | "resp_med_min" | "lat_med_s" | "sin_respuesta" | "correcciones" | "pct_barrido", f: (v: number) => string) => {
    if (!A || !B || A[k] == null || B[k] == null) return "Sin periodo anterior";
    const d = (A[k] as number) - (B[k] as number);
    const txt = k === "pct_10min" || k === "pct_barrido" ? pts(d * 100) : (d > 0 ? "+" : "") + (k === "por_dia" || k === "resp_med_min" ? f1(d) : String(Math.round(d)));
    return txt + " frente a los 7 días anteriores (" + f(B[k] as number) + ")";
  };
  const ult = dias.slice(-21);

  return (
    <>
      <p className="sub">{titular}</p>
      <Pildoras control={panel.control} aplicado={panel.aplicado} sha={panel.sha} maxFecha={max} />
      {error && <Aviso tono="mal" texto={"No se han podido leer las métricas del bot: " + error} />}
      {panel.error && <Aviso tono="aviso" texto={"No se ha podido leer el panel: " + panel.error} />}
      <div className="tarjeta">
        <div className={"estado" + (fallos.length >= 2 ? " mal" : fallos.length ? " aviso" : "")}>
          <i />
          <div>
            <span>{!A ? "Sin datos." : fallos.length ? (fallos.length === 1 ? "Una cosa fuera de límite" : fallos.length + " cosas fuera de límite") + " (del " + fmtDia(A.desde) + " al " + fmtDia(A.hasta) + "):" : "Nada fuera de límite del " + fmtDia(A.desde) + " al " + fmtDia(A.hasta) + "."}</span>
            {fallos.length > 0 && <ul>{fallos.map((f) => <li key={f}>{f}</li>)}</ul>}
          </div>
        </div>
        <p className="nota">Últimos 7 días con datos. Límites: una persona contesta en menos de 10 minutos (regla de Diego); el bot propone en menos de 60 segundos; ninguna propuesta caducada ni sin humano; menos del 30 % de propuestas por barrido (si sube, el relevo de Respond a GitHub está fallando y el bot llega tarde).</p>
        <form action={refrescar.bind(null, "/salud")} className="acciones"><button type="submit">Actualizar datos ahora</button><span className="nota">Las métricas se refrescan solas cada 5 minutos.</span></form>
      </div>
      {A && (
        <div className="kpis">
          <Kpi valor={f1(A.por_dia)} etiqueta="Propuestas al día" detalle={delta("por_dia", f1)} />
          <Kpi valor={p0(A.pct_10min)} etiqueta="Contestadas en menos de 10 min" detalle={delta("pct_10min", p0)} malo={A.pct_10min != null && A.pct_10min < 0.5} />
          <Kpi valor={A.resp_med_min == null ? "—" : f1(A.resp_med_min) + " min"} etiqueta="Minutos hasta que contesta una persona (mediana)" detalle={delta("resp_med_min", (v) => f1(v) + " min")} malo={A.resp_med_min != null && A.resp_med_min > LIM.resp_min} />
          <Kpi valor={A.lat_med_s == null ? "—" : Math.round(A.lat_med_s) + " s"} etiqueta="Segundos que tarda el bot (mediana)" detalle={delta("lat_med_s", (v) => Math.round(v) + " s")} malo={A.lat_med_s != null && A.lat_med_s > LIM.lat_s} />
          <Kpi valor={f0(A.sin_respuesta)} etiqueta="Propuestas sin respuesta humana" detalle={delta("sin_respuesta", f0)} malo={A.sin_respuesta > 0} />
          <Kpi valor={f0(A.correcciones)} etiqueta="Correcciones al bot" detalle={delta("correcciones", f0)} />
          <Kpi valor={p0(A.pct_barrido)} etiqueta="Propuestas por barrido" detalle={delta("pct_barrido", p0)} malo={A.pct_barrido > LIM.barrido} />
        </div>
      )}
      <div className="rejilla2">
        <div className="tarjeta">
          <div><h2>Minutos hasta que contesta una persona</h2><p className="nota">Mediana por día, desde el mensaje del lead hasta la primera respuesta humana. Línea discontinua: límite de 10 minutos. Rojo: día por encima del límite.</p></div>
          <Grafica etiqueta="Mediana" puntos={ult.map((d) => ({ x: d.dia, y: d.resp_med_min, malo: d.resp_med_min != null && d.resp_med_min > LIM.resp_min, detalle: [["Mediana", d.resp_med_min == null ? "—" : f1(d.resp_med_min) + " min"], ["Contestadas", f0(d.contestadas)], ["En menos de 10 min", p0(d.pct_10min)]] }))} fmt="min" xfmt="dia" referencia={{ v: LIM.resp_min, etiqueta: "10 min" }} />
        </div>
        <div className="tarjeta">
          <div><h2>Contestadas en menos de 10 minutos</h2><p className="nota">Parte de las propuestas de cada día a las que una persona contestó en menos de 10 minutos.</p></div>
          <Grafica tipo="barras" etiqueta="En menos de 10 min" puntos={ult.map((d) => ({ x: d.dia, y: d.pct_10min, malo: d.pct_10min != null && d.pct_10min < 0.5, detalle: [["En menos de 10 min", p0(d.pct_10min)], ["Contestadas", f0(d.contestadas)]] }))} fmt="pct" xfmt="dia" dominio={[0, 1]} />
        </div>
        <div className="tarjeta">
          <div><h2>Propuestas del bot por día</h2><p className="nota">Todas las propuestas de ventas, usadas o no.</p></div>
          <Grafica tipo="barras" etiqueta="Propuestas" puntos={ult.map((d) => ({ x: d.dia, y: d.propuestas, detalle: [["Propuestas", f0(d.propuestas)], ["Evaluadas", f0(d.evaluadas)], ["Por barrido", f0(d.barrido)], ["Sin respuesta", f0(d.sin_respuesta)]] }))} fmt="entero" xfmt="dia" />
        </div>
        <div className="tarjeta">
          <div><h2>Segundos que tarda el bot en proponer</h2><p className="nota">Mediana por día, solo propuestas por aviso. Línea discontinua: objetivo de 60 segundos.</p></div>
          <Grafica etiqueta="Mediana del bot" puntos={ult.map((d) => ({ x: d.dia, y: d.lat_med_s, malo: d.lat_med_s != null && d.lat_med_s > LIM.lat_s, detalle: [["Mediana del bot", d.lat_med_s == null ? "—" : Math.round(d.lat_med_s) + " s"]] }))} fmt="seg" xfmt="dia" referencia={{ v: LIM.lat_s, etiqueta: "60 s" }} />
        </div>
      </div>
    </>
  );
}
