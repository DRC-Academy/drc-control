import { test } from "node:test";
import assert from "node:assert/strict";
import type { Fila } from "../lib/datos";
import { objeciones, MIN_MADURAS, type FilaObj } from "../lib/objeciones";

let id = 1;
const obj = (cid: number, objecion: string, extra: Partial<FilaObj> = {}): FilaObj => ({
  fecha: "2026-10-10", cid, id: id++, etapa: "objecion", objecion, indicado: "aislar_objecion", propuesto: "aislar_objecion", sigue: "si",
  barra: "", estado: "usada", ...extra,
});
const metrica = (contact_id: number, etapa: string, fecha: string): Fila => ({
  fecha, contact_id, estado: "usada", area: "ventas", tipo: "respuesta", etapa, origen: "evento", tarde: false, latencia_s: 30, respuesta_s: 120,
  clase: "", grupo: "", enviada_por: "", traspaso: "", hora: "",
});
const HOY = "2026-10-16";

test("sin objeciones clasificadas no hay resultado, y NINGUNA no cuenta", () => {
  assert.equal(objeciones([], [], new Set(), HOY), null);
  assert.equal(objeciones([obj(1, "NINGUNA")], [], new Set(), HOY), null);
});

test("cuenta leads distintos por tipo, con su % sobre los leads con objeción, y ordena por frecuencia", () => {
  const filas = [
    obj(1, "PRECIO_ALTO"), obj(1, "PRECIO_ALTO"), obj(2, "PRECIO_ALTO"), obj(3, "PRECIO_ALTO"),
    obj(4, "LO_TIENE_QUE_PENSAR"), obj(5, "LO_TIENE_QUE_PENSAR"),
    obj(1, "LO_TIENE_QUE_PENSAR"),                       // el lead 1 tiene dos objeciones distintas
    obj(6, "NINGUNA"),
  ];
  const o = objeciones(filas, [], new Set(), HOY)!;
  assert.equal(o.leadsConObjecion, 5);
  assert.deepEqual(o.tipos.map((t) => [t.tipo, t.leads, t.propuestas]), [["PRECIO_ALTO", 3, 4], ["LO_TIENE_QUE_PENSAR", 3, 3]]);   // empatan en leads: orden alfabético por nombre ("Le parece caro" antes que "Lo tiene que pensar")
  const caro = o.tipos.find((t) => t.tipo === "PRECIO_ALTO")!;
  assert.equal(caro.nombre, "Le parece caro");
  assert.equal(caro.pct, 3 / 5);
});

test("el equipo copia tal cual solo cuando el estado es usada; otras palabras o distinto no cuentan", () => {
  const filas = [
    obj(1, "PRECIO_ALTO", { estado: "usada" }), obj(2, "PRECIO_ALTO", { estado: "usada" }), obj(3, "PRECIO_ALTO", { estado: "equivalente" }),
    obj(4, "PRECIO_ALTO", { estado: "valida" }), obj(5, "PRECIO_ALTO", { estado: "sustituida" }), obj(6, "PRECIO_ALTO", { estado: "caducada" }),
  ];
  const t = objeciones(filas, [], new Set(), HOY)!.tipos[0];
  assert.equal(t.copia, 2 / 4, "sustituida y caducada no tuvieron respuesta de una persona: no cuentan");
});

test("sigue el método y propone el recurso indicado", () => {
  const filas = [
    obj(1, "CONFIANZA_EMPRESA", { indicado: "testimonio", propuesto: "testimonio", sigue: "si" }),
    obj(2, "CONFIANZA_EMPRESA", { indicado: "testimonio", propuesto: "garantia", sigue: "parcial" }),
    obj(3, "CONFIANZA_EMPRESA", { indicado: "testimonio", propuesto: "ninguno", sigue: "no" }),
    obj(4, "CONFIANZA_EMPRESA", { indicado: "testimonio", propuesto: "testimonio", sigue: "si" }),
  ];
  const o = objeciones(filas, [], new Set(), HOY)!;
  const t = o.tipos[0];
  assert.equal(t.sigue, 0.5);
  assert.equal(t.coincide, 0.5);
  assert.equal(t.indicado, "Testimonio");
  assert.equal(o.global.sigue, 0.5);
});

test("avanza: llega a horario o cierre más tarde, o ya es alumno; las de menos de 3 días no cuentan", () => {
  const filas: FilaObj[] = [];
  const metricas: Fila[] = [];
  const alumnos = new Set<number>();
  for (let cid = 1; cid <= 12; cid++) filas.push(obj(cid, "PRECIO_ALTO", { fecha: "2026-10-10" }));   // 12 leads con tiempo de avanzar
  for (let cid = 1; cid <= 3; cid++) metricas.push(metrica(cid, "horario", "2026-10-12"));            // 3 avanzan a horario
  metricas.push(metrica(4, "cierre", "2026-10-11"));                                                   // 1 a cierre
  alumnos.add(5);                                                                                      // 1 ya es alumno
  metricas.push(metrica(6, "horario", "2026-10-10"));                                                  // mismo día: no cuenta como "después"
  metricas.push(metrica(7, "cualificacion", "2026-10-13"));                                            // otra etapa: no avanza
  for (let cid = 20; cid <= 25; cid++) filas.push(obj(cid, "PRECIO_ALTO", { fecha: "2026-10-15" }));   // recientes: aún no han tenido tiempo
  const t = objeciones(filas, metricas, alumnos, HOY)!.tipos[0];
  assert.equal(t.nAvanza, 12);
  assert.equal(t.avanza, 5 / 12);
});

test("con pocos leads maduros no se da un % de avance", () => {
  const filas = Array.from({ length: MIN_MADURAS - 1 }, (_, i) => obj(i + 1, "MAS_ADELANTE"));
  const t = objeciones(filas, [], new Set(), HOY)!.tipos[0];
  assert.equal(t.avanza, null);
  assert.equal(t.nAvanza, MIN_MADURAS - 1);
});

test("los desajustes son los pares indicado/propuesto distintos más repetidos, con al menos 5 casos", () => {
  const filas: FilaObj[] = [];
  for (let i = 1; i <= 6; i++) filas.push(obj(i, "COMPARA_PRECIO", { indicado: "competencia", propuesto: "aislar_objecion" }));
  for (let i = 7; i <= 10; i++) filas.push(obj(i, "COMPARA_PRECIO", { indicado: "competencia", propuesto: "competencia" }));
  for (let i = 11; i <= 13; i++) filas.push(obj(i, "COMPARA_PRECIO", { indicado: "competencia", propuesto: "garantia" }));   // solo 3: no sale
  const o = objeciones(filas, [], new Set(), HOY)!;
  assert.equal(o.desajustes.length, 1);
  assert.deepEqual(o.desajustes[0], { tipo: "COMPARA_PRECIO", nombre: "Compara precio", indicado: "Valor frente a otras opciones", propuesto: "Aislar la objeción", n: 6, pct: 6 / 13 });
});

test("los desajustes no cuentan la objeción Otra ni los casos en que el método no pide recurso", () => {
  const filas: FilaObj[] = [];
  for (let i = 1; i <= 8; i++) filas.push(obj(i, "OTRA", { indicado: "ninguno", propuesto: "garantia" }));
  for (let i = 9; i <= 16; i++) filas.push(obj(i, "PRECIO_ALTO", { indicado: "ninguno", propuesto: "garantia" }));
  for (let i = 17; i <= 24; i++) filas.push(obj(i, "OTRA", { indicado: "garantia", propuesto: "testimonio" }));
  assert.deepEqual(objeciones(filas, [], new Set(), HOY)!.desajustes, []);
});

test("un tipo o recurso desconocido se enseña tal cual en vez de romper", () => {
  const o = objeciones([obj(1, "TIPO_NUEVO", { indicado: "recurso_nuevo", propuesto: "recurso_nuevo" })], [], new Set(), HOY)!;
  assert.equal(o.tipos[0].nombre, "TIPO_NUEVO");
  assert.equal(o.tipos[0].indicado, "recurso_nuevo");
});

test("el rango de fechas son las de las propuestas clasificadas", () => {
  const o = objeciones([obj(1, "PRECIO_ALTO", { fecha: "2026-10-12" }), obj(2, "PRECIO_ALTO", { fecha: "2026-10-15" })], [], new Set(), HOY)!;
  assert.deepEqual([o.desde, o.hasta, o.propuestas], ["2026-10-12", "2026-10-15", 2]);
});
