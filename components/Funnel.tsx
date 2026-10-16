import { p0, p1 } from "@/lib/formato";

export type Escalon = { nombre: string; n: number; pct: number; pasa: number | null; peor?: boolean; compran?: boolean };

// Porcentaje legible: sin decimales, salvo por debajo del 10 % (5,6 %) donde un entero engaña.
const pc = (v: number) => (v < 0.1 ? p1(v) : p0(v));
const ancho = (v: number) => Math.max(5, Math.min(100, v * 100));

/**
 * Embudo en un solo cuerpo: cada escalón es un trozo cuyo ancho de arriba es su % de los leads y el de abajo el % del
 * siguiente, así el conjunto se estrecha sin saltos. Nombre a la izquierda, % a la derecha y nada más, salvo el trozo
 * donde más leads se pierden: va en rojo con lo que se pierde dentro. Solo pinta: los números salen de lib/resumen.ts.
 */
export default function Funnel({ escalones }: { escalones: Escalon[] }) {
  return (
    <div className="funnel" role="list">
      {escalones.map((e, i) => {
        const arriba = ancho(e.pct);
        const sig = escalones[i + 1];
        const abajo = sig ? Math.min(arriba, ancho(sig.pct)) : arriba;
        const fuga = sig?.peor && sig.pasa != null ? 1 - sig.pasa : null;   // lo que se pierde al pasar de este escalón al siguiente
        const forma = `polygon(${50 - arriba / 2}% 0, ${50 + arriba / 2}% 0, ${50 + abajo / 2}% 100%, ${50 - abajo / 2}% 100%)`;
        return (
          <div key={e.nombre} className="f-fila" role="listitem" title={e.n + " leads"}>
            <span className="f-nombre">{e.nombre}</span>
            <div
              className={"f-trozo" + (fuga != null ? " fuga" : "") + (e.compran ? " compran" : "")}
              style={{ clipPath: forma, opacity: fuga != null || e.compran ? 1 : Math.max(0.5, 1 - i * 0.1) }}
            >
              {fuga != null && <span>−{pc(fuga)}</span>}
            </div>
            <span className="f-pct">{pc(e.pct)}</span>
          </div>
        );
      })}
    </div>
  );
}
