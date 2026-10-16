import { Fragment } from "react";
import { p0, p1 } from "@/lib/formato";

export type Escalon = { nombre: string; n: number; pct: number; pasa: number | null; peor?: boolean; compran?: boolean };

// Porcentaje legible: sin decimales, salvo por debajo del 10 % (5,6 %) donde un entero engaña.
const pc = (v: number) => (v < 0.1 ? p1(v) : p0(v));
const ancho = (v: number) => Math.max(5, Math.min(100, v * 100));

/**
 * Embudo: una barra centrada por escalón, con un ancho igual a su % de los leads, y entre barras un tramo que se estrecha
 * (la pérdida). El tramo con más fuga va en rojo. Solo pinta: los números salen de lib/resumen.ts.
 */
export default function Funnel({ escalones }: { escalones: Escalon[] }) {
  return (
    <div className="funnel" role="list">
      {escalones.map((e, i) => {
        const w = ancho(e.pct);
        const arriba = i ? ancho(escalones[i - 1].pct) : w;
        const abajo = Math.min(w, arriba);
        const punto = (x: number) => (50 + x / 2) + "%";
        const punto0 = (x: number) => (50 - x / 2) + "%";
        return (
          <Fragment key={e.nombre}>
            {i > 0 && (
              <div className={"f-fila f-con" + (e.peor ? " peor" : "")} aria-hidden="true">
                <span />
                <div className="f-puente" style={{ clipPath: `polygon(${punto0(arriba)} 0, ${punto(arriba)} 0, ${punto(abajo)} 100%, ${punto0(abajo)} 100%)` }} />
                <span className="f-pasa">{e.pasa != null && e.pasa <= 1 ? "pasa " + pc(e.pasa) : ""}</span>
              </div>
            )}
            <div className={"f-fila" + (e.compran ? " f-compran" : "")} role="listitem" title={e.n + " leads"}>
              <span className="f-nombre">{e.nombre}</span>
              <div className="f-pista"><i className="f-barra" style={{ width: w + "%", opacity: e.compran ? 1 : Math.max(0.45, 1 - i * 0.12) }} /></div>
              <span className="f-pct">{pc(e.pct)}</span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
