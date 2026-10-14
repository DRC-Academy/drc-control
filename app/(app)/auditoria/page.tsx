import { cargar } from "@/lib/cargar";
import { porDia, periodos, fases, stats, sig, EV, FASES, EMBUDO_N, LIM, maxFecha } from "@/lib/analisis";
import { f0, f1, p0, fmtDia, addDias } from "@/lib/formato";
import BarraH from "@/components/BarraH";
import Pildoras from "@/components/Pildoras";
import Aviso from "@/components/Aviso";

export const dynamic = "force-dynamic";

const FALLA: Record<string, [string, string]> = {
  horario: ["El bot mete prisa para cerrar, pero la persona solo quiere elegir su horario.", "Que el bot proponga 2 horarios concretos, sin prisa ni descuentos."],
  cierre: ["El bot mete prisa (descuento, \"se pierde el hueco\"). La persona prefiere preguntar la fecha o la hora.", "Que el bot pida la fecha de inicio y envíe el enlace de pago, sin presión."],
  objecion: ["La persona cambia lo que propone el bot cuando alguien duda.", "Mirar qué cambia y copiar esas respuestas como ejemplo para el bot."],
  precio: ["La persona cambia lo que dice el bot sobre precios o planes.", "Comprobar que precios y planes del bot están al día."],
  explicacion: ["La persona reescribe cómo el bot explica el programa.", "Mirar qué cambia y copiarlo como ejemplo."],
  cualificacion: ["La persona reescribe las primeras preguntas del bot.", "Mirar qué cambia y copiarlo como ejemplo."],
};
const CL: Record<string, string> = { forma: "Forma", lectura: "Lectura", politica: "Política", regla_diego: "Regla de Diego", sin_fallo: "Sin fallo", "": "Sin clase" };

export default async function Auditoria() {
  const { filas, alumnos, panel, error } = await cargar();
  const max = maxFecha(filas);
  const dias = porDia(filas).slice(-21).reverse();
  const [Asem] = periodos(filas);
  const out: [string, string, string][] = [];
  if (max) {
    const A = stats(filas, addDias(max, -6), max, alumnos), B = stats(filas, addDias(max, -13), addDias(max, -7), alumnos);
    const rowsF = FASES.map(([k, nm]) => ({ k, nm, a: A.fase[k], b: B.fase[k] }));
    const cand = rowsF.filter((r) => r.a.n >= 30 && r.b.n >= 30).map((r) => ({ ...r, d: r.a.uso - r.b.uso, s: sig(r.a.uso, r.a.n, r.b.uso, r.b.n) }));
    const best = cand.filter((r) => r.s === "clara" && r.d > 0).sort((x, y) => y.d - x.d)[0];
    const worst = cand.filter((r) => r.s === "clara" && r.d < 0).sort((x, y) => x.d - y.d)[0];
    const weak = rowsF.filter((r) => r.a.n >= 30).sort((x, y) => x.a.uso - y.a.uso)[0];
    let worstI = -1, wl = -1;
    for (let i = 1; i < 5; i++) { const lo = A.reach[i - 1] ? (A.reach[i - 1] - A.reach[i]) / A.reach[i - 1] : 0; if (lo > wl) { wl = lo; worstI = i; } }
    if (weak && weak.a.uso < 0.7) { const F = FALLA[weak.k] || FALLA.objecion; out.push(["Fase más floja: " + weak.nm, "Qué falla: " + F[0] + " Solo se usa la propuesta el " + p0(weak.a.uso) + " de las veces.", "Qué hacer: " + F[1]]); }
    if (worstI > 0 && wl > 0.3 && A.reach[0] >= 30) out.push(["Donde más gente se pierde: " + EMBUDO_N[worstI - 1] + " → " + EMBUDO_N[worstI], "Qué falla: se pierde el " + p0(wl) + " de las personas entre una fase y la siguiente.", worstI === 3 ? "Qué hacer: tras dar el precio, enviar un mensaje corto de seguimiento y ofrecer pago fraccionado si dudan." : "Qué hacer: revisar qué se les dice justo antes y simplificar el mensaje."]);
    if (worst) out.push(["Ha empeorado: " + worst.nm, "Qué falla: el uso baja del " + p0(worst.b.uso) + " al " + p0(worst.a.uso) + ".", "Qué hacer: mirar qué cambió en esa fase estos días (Comparar periodos) y deshacerlo si fue eso."]);
    else if (best) out.push(["Ha mejorado: " + best.nm, "Va mejor: el uso sube del " + p0(best.b.uso) + " al " + p0(best.a.uso) + ".", "Qué hacer: mantener lo que se hizo y anotarlo como bueno."]);
    if (Asem && Asem.resp_med_min != null && Asem.resp_med_min > LIM.resp_min) out.push(["Cuello de botella: la respuesta humana", "Qué falla: una persona tarda " + f1(Asem.resp_med_min) + " minutos (mediana) en contestar lo que el bot ya tiene propuesto; el límite es 10.", "Qué hacer: en las fases listas, dejar que el bot responda solo al grupo de control (Preparación por fase)."]);
  }
  if (!out.length) out.push(["Sin hallazgos", "Ninguna fase cambia más de lo que explica la casualidad.", "Qué hacer: no cambiar nada y seguir midiendo."]);
  const desde14 = max ? addDias(max, -13) : "";
  const clases = new Map<string, number>();
  filas.filter((r) => r.estado === "correccion" && r.fecha >= desde14).forEach((r) => clases.set(r.clase, (clases.get(r.clase) || 0) + 1));
  const cl = [...clases.entries()].sort((a, b) => b[1] - a[1]);
  const tot = cl.reduce((s, x) => s + x[1], 0) || 1;
  const f14 = fases(filas, 14);
  const mx = Math.max(...f14.map((r) => r.err100 || 0), 1);
  void EV;
  return (
    <>
      <Pildoras control={panel.control} aplicado={panel.aplicado} sha={panel.sha} maxFecha={max} />
      {error && <Aviso tono="mal" texto={"No se han podido leer las métricas del bot: " + error} />}
      <div className="tarjeta">
        <div><h2>Qué falla y qué hacer</h2><p className="nota">Máximo tres cosas, con los últimos 7 días frente a los 7 anteriores. Solo sale lo que no explica la casualidad.</p></div>
        <div className="actos">{out.slice(0, 3).map(([t, b, p]) => <div className="acto" key={t}><span className="t">{t}</span><b>{b}</b><p>{p}</p></div>)}</div>
      </div>
      <div className="tarjeta">
        <div><h2>Día a día</h2><p className="nota">Una fila por día. Sin respuesta = caducadas más sin humano. Barrido = propuestas que no llegaron por aviso y las recogió la ronda (señal de fallo del relevo).</p></div>
        <div className="tw">
          <table>
            <thead><tr><th>Día</th><th>Propuestas</th><th>Uso tal cual</th><th>Correcciones</th><th>Errores del humano</th><th>Sin respuesta</th><th>Tarde</th><th>Por barrido</th><th>En menos de 10 min</th><th>Persona, mediana (min)</th><th>Bot, mediana (s)</th></tr></thead>
            <tbody>{dias.map((d) => <tr key={d.dia}><td>{fmtDia(d.dia)}</td><td>{f0(d.propuestas)}</td><td>{p0(d.uso)}</td><td>{f0(d.correcciones)}</td><td>{f0(d.errores_humano)}</td><td>{f0(d.sin_respuesta)}</td><td>{f0(d.tarde)}</td><td>{p0(d.pct_barrido)}</td><td>{p0(d.pct_10min)}</td><td>{f1(d.resp_med_min)}</td><td>{d.lat_med_s == null ? "—" : String(Math.round(d.lat_med_s))}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="rejilla2">
        <div className="tarjeta">
          <div><h2>Correcciones al bot, por tipo</h2><p className="nota">Últimos 14 días. Forma: tono o redacción. Lectura: leyó mal el chat. Política: pedía algo que está apagado. Regla de Diego: cambió una regla. Sin fallo: se revisó y el bot no se había equivocado.</p></div>
          {cl.length ? <BarraH filas={cl.map(([k, n]) => ({ etiqueta: CL[k] || k, valor: n / tot, texto: f0(n) + " (" + p0(n / tot) + ")", clase: k === "sin_fallo" ? "gris" : "" }))} /> : <p className="nota">Sin correcciones en los últimos 14 días.</p>}
        </div>
        <div className="tarjeta">
          <div><h2>Errores del humano por fase</h2><p className="nota">Últimos 14 días, por cada 100 respuestas evaluadas. Mide a la persona: en las fases donde el humano falla más y el bot ya está listo, el bot puede hacerlo mejor.</p></div>
          <BarraH maximo={mx} filas={f14.map((r) => ({ etiqueta: r.nombre, valor: r.err100, texto: r.err100 != null ? f1(r.err100) + " por 100 · n " + r.n : "sin datos", clase: r.err100 != null && r.err100 >= 5 ? "mal" : "" }))} />
        </div>
      </div>
    </>
  );
}
