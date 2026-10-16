import { test } from "node:test";
import assert from "node:assert/strict";
import type { Fila } from "../lib/datos";
import { autonomia, MIN_RESPUESTAS } from "../lib/autonomia";

let id = 1;
const fila = (etapa: string, estado: string, fecha = "2026-10-15"): Fila => ({
  fecha, contact_id: id++, estado, area: "ventas", tipo: "respuesta", etapa, origen: "evento", tarde: false,
  latencia_s: 30, respuesta_s: 120, clase: "", grupo: "", enviada_por: "", traspaso: "", hora: "",
});
// n respuestas evaluadas de una fase, `copiadas` de ellas tal cual (usada) y el resto válidas pero distintas
function fase(etapa: string, n: number, copiadas: number, fecha?: string): Fila[] {
  return Array.from({ length: n }, (_, i) => fila(etapa, i < copiadas ? "usada" : "valida", fecha));
}

test("hasta dónde llega la cadena: la primera fase que no pasa el 85 % corta", () => {
  const filas = [...fase("cualificacion", 100, 94), ...fase("explicacion", 60, 54), ...fase("precio", 80, 70), ...fase("objecion", 100, 77), ...fase("horario", 60, 54)];
  const a = autonomia(filas)!;
  assert.equal(a.hasta, "precio");
  assert.equal(a.hastaNombre, "Precio");
  assert.deepEqual(a.etapas.map((e) => e.estado), ["lista", "lista", "lista", "falla", "despues", "despues"]);
  assert.equal(a.corta!.fase, "objecion");
  // las tres fases listas juntas: (94 + 54 + 70) copiadas de (100 + 60 + 80)
  assert.equal(a.nHasta, 240);
  assert.ok(Math.abs((a.copiaHasta as number) - 218 / 240) < 1e-9);
});

test("solo cuenta como copiada la que se envía tal cual: con otras palabras o distinta no", () => {
  const filas = [
    ...Array.from({ length: 60 }, () => fila("cualificacion", "usada")),
    ...Array.from({ length: 40 }, () => fila("cualificacion", "equivalente")),
    ...Array.from({ length: 10 }, () => fila("cualificacion", "valida")),
    ...Array.from({ length: 10 }, () => fila("cualificacion", "error_sin_mencion")),
  ];
  const e = autonomia(filas)!.etapas[0];
  assert.equal(e.n, 120);
  assert.equal(e.copia, 0.5);
  assert.equal(e.estado, "falla");
});

test("una fase con pocas respuestas corta la cadena: no se da por lista sin datos", () => {
  const filas = [...fase("cualificacion", 100, 95), ...fase("explicacion", MIN_RESPUESTAS - 1, MIN_RESPUESTAS - 1), ...fase("precio", 100, 100)];
  const a = autonomia(filas)!;
  assert.equal(a.hasta, "cualificacion");
  assert.equal(a.etapas[1].estado, "pocos");
  assert.equal(a.etapas[2].estado, "despues", "aunque precio vaya perfecto, no se llega a precio sin pasar por explicación");
  assert.equal(a.corta!.fase, "explicacion");
});

test("justo en el 85 % pasa, y con 50 respuestas basta", () => {
  const a = autonomia(fase("cualificacion", 100, 85))!;
  assert.equal(a.etapas[0].estado, "lista");
  const b = autonomia(fase("cualificacion", MIN_RESPUESTAS, 43))!;   // 86 %
  assert.equal(b.etapas[0].estado, "lista");
});

test("si ni la primera fase pasa, no hay fase hasta la que pueda responder solo", () => {
  const a = autonomia(fase("cualificacion", 100, 60))!;
  assert.equal(a.hasta, null);
  assert.equal(a.copiaHasta, null);
  assert.equal(a.nHasta, 0);
});

test("solo se miran los últimos 14 días con datos", () => {
  const viejas = fase("cualificacion", 100, 0, "2026-09-20");        // todas fallidas, pero de hace un mes
  const recientes = fase("cualificacion", 100, 100, "2026-10-15");
  const a = autonomia([...viejas, ...recientes])!;
  assert.equal(a.etapas[0].n, 100);
  assert.equal(a.etapas[0].copia, 1);
  assert.equal(a.desde, "2026-10-02");
});

test("sin datos no hay resultado", () => {
  assert.equal(autonomia([]), null);
});
