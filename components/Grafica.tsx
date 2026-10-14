"use client";
// Gráfica de líneas o de barras en SVG, con tooltip. Mide su ancho con ResizeObserver.
import { useEffect, useRef, useState } from "react";
import { p0, f0, f1, fmtDia } from "@/lib/formato";

export type Formato = "pct" | "entero" | "decimal" | "min" | "seg";
const FMT: Record<Formato, (v: number) => string> = {
  pct: (v) => p0(v), entero: (v) => f0(v), decimal: (v) => f1(v), min: (v) => f1(v) + " min", seg: (v) => Math.round(v) + " s",
};
const XFMT: Record<string, (x: string) => string> = { dia: (x) => fmtDia(x), semana: (x) => "sem. " + fmtDia(x) };

export type Punto = { x: string; y: number | null; malo?: boolean; detalle?: [string, string][] };
type Props = {
  puntos: Punto[];
  tipo?: "linea" | "barras";
  fmt: Formato;
  xfmt?: "dia" | "semana";
  dominio?: [number, number];
  referencia?: { v: number; etiqueta?: string };
  etiqueta: string;
  alto?: number;
};

function ticks(min: number, max: number, n = 4): number[] {
  const span = max - min || 1;
  const paso0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(paso0)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= paso0) || mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) out.push(Number(v.toFixed(10)));
  return out;
}

export default function Grafica({ puntos, tipo = "linea", fmt: fmtNombre, xfmt: xfmtNombre, dominio, referencia, etiqueta, alto = 200 }: Props) {
  const fmt = FMT[fmtNombre];
  const xfmt = xfmtNombre ? XFMT[xfmtNombre] : undefined;
  const caja = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => { const w = es[0]?.contentRect.width; if (w) setW(Math.max(240, Math.floor(w))); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!puntos.length) return <div ref={caja} className="grafica" style={{ minHeight: alto }}><p className="nota">Sin datos.</p></div>;
  const H = alto, m = { t: 14, r: 14, b: 26, l: 44 };
  const vals = puntos.map((p) => p.y).filter((v): v is number => v != null);
  const ymin = dominio ? dominio[0] : 0;
  const ymax = dominio ? dominio[1] : Math.max(Math.max(...vals, 0), referencia?.v ?? 0) * 1.12 || 1;
  const y = (v: number) => m.t + (H - m.t - m.b) * (1 - (v - ymin) / (ymax - ymin || 1));
  const n = puntos.length;
  const ancho = W - m.l - m.r;
  const banda = ancho / n;
  const cx = (i: number) => m.l + banda * (i + 0.5);
  const tk = ticks(ymin, ymax);
  const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(ancho / 58))));
  const h = hover != null ? puntos[hover] : null;
  return (
    <div ref={caja} className="grafica" style={{ minHeight: alto }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }} role="img" aria-label={etiqueta}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.min(n - 1, Math.max(0, Math.floor((px - m.l) / banda)));
          setHover(i);
        }}>
        {tk.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="rejilla" />
            <text x={m.l - 6} y={y(v) + 3} textAnchor="end" className="eje">{fmt(v)}</text>
          </g>
        ))}
        {puntos.map((p, i) => (i % cada === 0 ? <text key={p.x} x={cx(i)} y={H - 8} textAnchor="middle" className="eje">{xfmt ? xfmt(p.x) : p.x}</text> : null))}
        {referencia && (
          <g>
            <line x1={m.l} x2={W - m.r} y1={y(referencia.v)} y2={y(referencia.v)} className="referencia" />
            {referencia.etiqueta && <text x={W - m.r} y={y(referencia.v) - 4} textAnchor="end" className="eje">{referencia.etiqueta}</text>}
          </g>
        )}
        {tipo === "barras"
          ? puntos.map((p, i) => p.y == null ? null : (
              <rect key={p.x} x={cx(i) - banda * 0.36} y={y(Math.max(p.y, 0))} width={banda * 0.72} height={Math.max(0, y(0) - y(p.y))} rx={3}
                className={p.malo ? "marca mala" : "marca"} opacity={hover == null || hover === i ? 1 : 0.55} />
            ))
          : (
            <g>
              <path className="trazo" d={puntos.reduce((d, p, i) => (p.y == null ? d : d + (d ? " L" : "M") + cx(i) + " " + y(p.y)), "")} />
              {puntos.map((p, i) => p.y == null ? null : (
                <circle key={p.x} cx={cx(i)} cy={y(p.y)} r={hover === i ? 5 : 3.5} className={p.malo ? "punto malo" : "punto"} />
              ))}
            </g>
          )}
        {h && <line x1={cx(hover as number)} x2={cx(hover as number)} y1={m.t} y2={H - m.b} className="referencia" />}
      </svg>
      {h && (
        <div className="tip" style={{ left: Math.min(Math.max((cx(hover as number) / W) * 100, 0), 70) + "%", top: 6 }}>
          <div className="tt">{xfmt ? xfmt(h.x) : h.x}</div>
          {(h.detalle || [[etiqueta, h.y == null ? "—" : fmt(h.y)]]).map(([k, v]) => <div key={k}>{k}: {v}</div>)}
        </div>
      )}
    </div>
  );
}
