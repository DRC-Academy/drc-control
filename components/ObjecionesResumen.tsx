import Link from "next/link";
import { f0, fmtDia, p0 } from "@/lib/formato";
import type { Objeciones } from "@/lib/objeciones";
import { MIN_LEADS_TIPO } from "@/lib/objeciones";

/** Tarjeta de la portada: las objeciones que más frenan la compra y cuánto avanza el lead después. Lo demás está en /objeciones. */
export default function ObjecionesResumen({ datos }: { datos: Objeciones | null }) {
  if (!datos) return <p className="vacio">Todavía no hay objeciones clasificadas: el bot las va clasificando cada noche.</p>;
  // "Otra" es un cajón de sastre: no encabeza la lista ni el titular (sigue en el detalle)
  const top = datos.tipos.filter((t) => t.leads >= MIN_LEADS_TIPO && t.tipo !== "OTRA").slice(0, 5);
  const primera = top[0];
  const maximo = primera ? primera.pct : 1;
  const conAvance = top.filter((t) => t.avanza != null);
  const peor = conAvance.length > 1 ? conAvance.reduce((m, t) => ((t.avanza as number) < (m.avanza as number) ? t : m)) : null;
  return (
    <>
      {primera && (
        <p className="titular">
          Lo que más frena: <b>{primera.nombre}</b>, en el {p0(primera.pct)} de los leads que ponen alguna objeción.
          {peor && (peor.tipo === primera?.tipo
            ? <> Y es la que menos avanza después: solo el {p0(peor.avanza)} llega a horario o cierre.</>
            : <> Tras la objeción, la que menos avanza es <b>{peor.nombre}</b>: llega a horario o cierre el {p0(peor.avanza)}.</>)}
        </p>
      )}
      <div className="obj" role="list">
        {top.map((t) => (
          <div key={t.tipo} className="o-fila" role="listitem" title={t.leads + " leads"}>
            <span className="o-nombre">{t.nombre}<small className={t.avanza != null && t.avanza < 0.3 ? "mal" : ""}>{t.avanza == null ? "avance: pocos datos" : "avanza " + p0(t.avanza)}</small></span>
            <div className="o-pista"><i style={{ width: Math.max(4, (t.pct / maximo) * 100) + "%" }} /></div>
            <span className="o-pct">{p0(t.pct)}</span>
          </div>
        ))}
      </div>
      <p className="suave">
        Sobre {f0(datos.leadsConObjecion)} leads con objeción ({fmtDia(datos.desde)} a {fmtDia(datos.hasta)}). El bot propone el recurso que indica el método en el {p0(datos.global.coincide)} de los casos y
        la persona envía su propuesta tal cual en el {p0(datos.global.copia)}.
      </p>
      <div><Link href="/objeciones" className="boton-suave">Ver detalle por objeción</Link></div>
    </>
  );
}
