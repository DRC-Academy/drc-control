import Link from "next/link";
import { cargar } from "@/lib/cargar";
import { leerObjeciones } from "@/lib/objecionesServidor";
import { objeciones, MIN_LEADS_TIPO, type ResumenTipo } from "@/lib/objeciones";
import { f0, fmtDia, hoyIso, p0 } from "@/lib/formato";

export const dynamic = "force-dynamic";

const tono = (v: number | null): string => (v == null ? "" : v >= 0.8 ? " bien" : v < 0.6 ? " mal" : "");

function Tipo({ t }: { t: ResumenTipo }) {
  return (
    <div className="o-tipo">
      <h3>{t.nombre}<span>{f0(t.leads)} leads · {p0(t.pct)}</span></h3>
      <div className="o-medidas">
        <div className={"o-medida" + tono(t.copia)}><b>{p0(t.copia)}</b><span>La persona envía la propuesta del bot tal cual</span></div>
        <div className={"o-medida" + tono(t.sigue)}><b>{p0(t.sigue)}</b><span>La propuesta sigue el método</span></div>
        <div className={"o-medida" + tono(t.coincide)}><b>{p0(t.coincide)}</b><span>Propone el recurso que indica el método</span></div>
        <div className="o-medida"><b>{t.avanza == null ? "pocos datos" : p0(t.avanza)}</b><span>Avanza después{t.avanza == null ? "" : " (de " + f0(t.nAvanza) + " leads)"}</span></div>
      </div>
      <p className="o-recurso">El método indica: <b>{t.indicado ?? "nada"}</b>. El bot propone sobre todo: <b>{t.propuesto ?? "nada"}</b>.</p>
    </div>
  );
}

export default async function Objeciones() {
  const { filas, alumnos, error } = await cargar();
  let rows: Awaited<ReturnType<typeof leerObjeciones>> = [];
  let fallo: string | null = null;
  try {
    rows = await leerObjeciones();
  } catch (e) {
    fallo = (e as Error).message;
  }
  const o = objeciones(rows, filas, alumnos, hoyIso());
  // "Otra" es un cajón de sastre: va la última aunque sea la mayor
  const frecuentes = o ? o.tipos.filter((t) => t.leads >= MIN_LEADS_TIPO) : [];
  const principales = [...frecuentes.filter((t) => t.tipo !== "OTRA"), ...frecuentes.filter((t) => t.tipo === "OTRA")];
  const otras = o ? o.tipos.filter((t) => t.leads < MIN_LEADS_TIPO) : [];

  return (
    <>
      <div className="titulo-pag">
        <Link href="/" className="atras">← Inicio</Link>
        <h1>Objeciones</h1>
      </div>
      {fallo && <div className="flash mal">No se pueden leer las objeciones clasificadas: {fallo}</div>}
      {error && <div className="flash mal">No se pueden leer las métricas del bot: {error}</div>}
      {!o ? (
        <section className="card"><p className="vacio">Todavía no hay objeciones clasificadas. El bot las clasifica cada noche a partir de sus propuestas; aparecerán aquí desde mañana.</p></section>
      ) : (
        <>
          <section className="card">
            <h2>Qué mide esto</h2>
            <p className="linea">{f0(o.propuestas)} propuestas de ventas con objeción, de {f0(o.leadsConObjecion)} leads ({fmtDia(o.desde)} a {fmtDia(o.hasta)}).</p>
            <p className="suave">
              Una IA lee cada propuesta con el método de venta delante y dice qué objeción pone el lead, qué recurso indica el método para ella y qué propone el bot. Un lead puede
              tener varias objeciones. «Avanza» es que el lead llega a horario o cierre en un día posterior, o ya es alumno; solo cuenta a los leads con al menos 3 días. Es una
              valoración de una IA (dos pasadas independientes coincidieron en el tipo exacto un 68 %): sirve para ver tendencias y dónde mirar a mano, no para juzgar un chat concreto.
            </p>
          </section>

          <section className="card">
            <h2>Por objeción, de más a menos frecuente</h2>
            {principales.map((t) => <Tipo key={t.tipo} t={t} />)}
            {otras.length > 0 && (
              <details>
                <summary>Otras con menos de {MIN_LEADS_TIPO} leads ({otras.length})</summary>
                <div>{otras.map((t) => <Tipo key={t.tipo} t={t} />)}</div>
              </details>
            )}
          </section>

          <section className="card">
            <h2>Dónde el bot no propone lo que indica el método</h2>
            {o.desajustes.length === 0 ? (
              <p className="vacio">Ningún par repetido en al menos 5 casos.</p>
            ) : (
              o.desajustes.map((d) => (
                <div key={d.tipo + d.indicado + d.propuesto} className="o-desajuste">
                  <span><b>{d.nombre}</b>: el método indica {d.indicado} y el bot propone {d.propuesto}</span>
                  <small>{f0(d.n)} propuestas, el {p0(d.pct)} de las de esta objeción</small>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}
