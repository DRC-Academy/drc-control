import { test } from "node:test";
import assert from "node:assert/strict";
import { parecidoDiego, leerFilasParecido, type FilaPar } from "../lib/parecido";

const f = (fecha: string, parecido: number): FilaPar => ({ fecha, cid: 1, etapa: "objecion", parecido });
const HOY = "2026-10-26";

test("sin filas no hay resultado", () => {
  assert.equal(parecidoDiego([], HOY), null);
});

test("últimos 7 días frente a los 7 anteriores, en puntos", () => {
  const p = parecidoDiego([f("2026-10-25", 0.7), f("2026-10-21", 0.5), f("2026-10-18", 0.4), f("2026-10-10", 0.9)], HOY)!;
  assert.equal(p.ult.n, 2);
  assert.equal(Math.round(p.ult.media! * 100), 60);
  assert.equal(p.ult.altas, 1);
  assert.equal(p.prev.n, 1);
  assert.equal(Math.round(p.delta!), 20);
});

test("semanas desde la primera con datos, de lunes a domingo", () => {
  const p = parecidoDiego([f("2026-10-25", 0.6), f("2026-10-23", 0.62), f("2026-10-26", 0.7)], HOY)!;
  assert.deepEqual(p.semanas.map((s) => [s.x, s.n]), [["2026-10-19", 2], ["2026-10-26", 1]]);
  assert.equal(p.prev.n, 0);
  assert.equal(p.delta, null);
});

test("lee el jsonl del bot e ignora lo roto", () => {
  const t = '{"id": "1", "fecha": "2026-10-25", "cid": 7, "etapa": "precio", "parecido": 0.61}\nroto\n{"fecha": "2026-10-25"}\n';
  assert.deepEqual(leerFilasParecido(t), [{ fecha: "2026-10-25", cid: 7, etapa: "precio", parecido: 0.61 }]);
});
