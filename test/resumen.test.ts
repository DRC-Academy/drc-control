import { test } from "node:test";
import assert from "node:assert/strict";
import type { Fila } from "../lib/datos";
import { cierre, embudo, respuestaPersonas } from "../lib/resumen";
import { programacionRapida, esRapido, PROGRAMACION_DEFECTO } from "../lib/rapidos";
import { activa } from "../lib/programacion";

const fila = (contact_id: number, etapa: string, extra: Partial<Fila> = {}): Fila => ({
  fecha: "2026-10-10", contact_id, estado: "usada", area: "ventas", tipo: "respuesta", etapa, origen: "evento", tarde: false,
  latencia_s: 30, respuesta_s: 120, clase: "", grupo: "", enviada_por: "", traspaso: "", hora: "", ...extra,
});

// 100 leads atendidos; 80 llegan a explicación, 30 a precio, 25 a horario y 20 a cierre. Los 10 primeros ya son alumnos.
function lleno(): Fila[] {
  const out: Fila[] = [];
  const etapas: [string, number][] = [["cualificacion", 100], ["explicacion", 80], ["precio", 30], ["horario", 25], ["cierre", 20]];
  for (const [etapa, n] of etapas) for (let i = 1; i <= n; i++) out.push(fila(i, etapa));
  return out;
}
const alumnos = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

test("el embudo marca el paso donde más leads se pierden", () => {
  const e = embudo(lleno(), alumnos)!;
  assert.equal(e.leads, 100);
  assert.equal(e.ventas, 10);
  assert.deepEqual(e.pasos.map((p) => p.n), [100, 80, 30, 25, 20]);
  assert.deepEqual(e.pasos.map((p) => p.nombre), ["Cualificación", "Explicación", "Precio", "Horario", "Cierre"]);
  assert.equal(e.pasos[0].pasa, null);
  assert.ok(Math.abs((e.pasos[2].pasa as number) - 0.375) < 1e-9);
  assert.deepEqual(e.peor && { de: e.peor.de, a: e.peor.a }, { de: "Explicación", a: "Precio" });
  assert.deepEqual(e.pasos.map((p) => p.peor), [false, false, true, false, false]);
});

test("un paso al que llegan menos de 20 leads no cuenta como cuello de botella", () => {
  const poco: Fila[] = [];
  for (let i = 1; i <= 25; i++) poco.push(fila(i, "cualificacion"));
  for (let i = 1; i <= 15; i++) poco.push(fila(i, "explicacion"));
  for (let i = 1; i <= 2; i++) poco.push(fila(i, "precio"));   // de 15 a 2, pero a explicación llegan solo 15
  const e = embudo(poco, new Set())!;
  assert.equal(e.pasos[1].peor, true, "de 25 a 15 sí cuenta (llegan 25)");
  assert.equal(e.pasos[2].peor, false);
});

test("sin datos no hay embudo ni cierre", () => {
  assert.equal(embudo([], alumnos), null);
  assert.equal(cierre([], alumnos), null);
});

test("el cierre de todos los leads atendidos: ventas entre leads", () => {
  const c = cierre(lleno(), alumnos)!;
  assert.equal(c.origen, "todos");
  assert.equal(c.bot, null);
  assert.equal(c.veredicto, null);
  assert.deepEqual([c.persona.leads, c.persona.ventas], [100, 10]);
  assert.equal(c.persona.conv, 0.1);
  assert.equal(c.sinVentas, false);
});

test("sin conexión con Respond se avisa en vez de enseñar un 0 % falso", () => {
  const c = cierre(lleno(), new Set())!;
  assert.equal(c.sinVentas, true);
  assert.equal(c.persona.ventas, 0);
});

function conGrupos(botLeads: number, botVentas: number, ctlLeads: number, ctlVentas: number): { filas: Fila[]; alumnos: Set<number> } {
  const filas = lleno();
  const al = new Set(alumnos);
  for (let i = 0; i < botLeads; i++) { filas.push(fila(1000 + i, "precio", { grupo: "bot" })); if (i < botVentas) al.add(1000 + i); }
  for (let i = 0; i < ctlLeads; i++) { filas.push(fila(2000 + i, "precio", { grupo: "control" })); if (i < ctlVentas) al.add(2000 + i); }
  return { filas, alumnos: al };
}

test("con grupo de control se compara el bot solo con una persona", () => {
  const { filas, alumnos: al } = conGrupos(80, 24, 80, 8);
  const c = cierre(filas, al)!;
  assert.equal(c.origen, "grupo");
  assert.deepEqual([c.bot!.leads, c.bot!.ventas, c.persona.leads, c.persona.ventas], [80, 24, 80, 8]);
  assert.equal(c.bot!.conv, 0.3);
  assert.equal(c.persona.conv, 0.1);
  assert.equal(c.veredicto, "clara");
});

test("una diferencia pequeña entre grupos no se presenta como concluyente", () => {
  const { filas, alumnos: al } = conGrupos(60, 12, 60, 6);
  assert.equal(cierre(filas, al)!.veredicto, "no concluyente");
});

test("con pocos leads en un grupo, no se compara", () => {
  const { filas, alumnos: al } = conGrupos(10, 5, 60, 6);
  assert.equal(cierre(filas, al)!.veredicto, "pequeña");
});

test("lo que tarda una persona en contestar, frente al límite de 10 minutos", () => {
  const bien = respuestaPersonas(lleno())!;
  assert.equal(bien.min, 2);
  assert.equal(bien.mala, false);
  const tarde = respuestaPersonas(lleno().map((f) => ({ ...f, respuesta_s: 900 })))!;
  assert.equal(tarde.min, 15);
  assert.equal(tarde.mala, true);
  assert.equal(respuestaPersonas([]), null);
});

// ---- atajos de la pantalla principal ----
const z = "Europe/Madrid";

test("los atajos de una, dos y cuatro horas terminan en la hora que toca", () => {
  const ahora = new Date("2026-10-16T09:00:00Z");
  for (const [a, h] of [["r1h", 1], ["r2h", 2], ["r4h", 4]] as const) {
    const r = programacionRapida(a, ahora);
    assert.ok("prog" in r);
    if ("prog" in r) {
      assert.equal(r.prog.tipo, "hasta");
      assert.equal(r.prog.hasta, new Date(ahora.getTime() + h * 3600e3).toISOString());
      assert.equal(activa(r.prog, ahora).activo, true);
      assert.equal(activa(r.prog, new Date(ahora.getTime() + (h * 60 + 1) * 60000)).activo, false);
    }
  }
});

test("hoy llega hasta las 21:00 de Madrid y después de esa hora no se puede", () => {
  const antes = programacionRapida("rhoy", new Date("2026-10-16T09:00:00Z"));   // 11:00 Madrid
  assert.ok("prog" in antes);
  if ("prog" in antes) assert.equal(antes.prog.hasta, "2026-10-16T19:00:00.000Z");   // 21:00 Madrid
  const despues = programacionRapida("rhoy", new Date("2026-10-16T19:30:00Z"));   // 21:30 Madrid
  assert.ok("error" in despues);
});

test("el fin de semana son el sábado y el domingo enteros", () => {
  const r = programacionRapida("rfinde", new Date("2026-10-16T09:00:00Z"));
  assert.ok("prog" in r);
  if ("prog" in r) {
    assert.equal(activa(r.prog, new Date("2026-10-17T10:00:00Z")).activo, true);    // sábado
    assert.equal(activa(r.prog, new Date("2026-10-18T20:00:00Z")).activo, true);    // domingo 22:00 Madrid
    assert.equal(activa(r.prog, new Date("2026-10-19T10:00:00Z")).activo, false);   // lunes
  }
});

test("la programación por defecto es todos los días en el horario del bot", () => {
  assert.equal(PROGRAMACION_DEFECTO.zona, z);
  assert.equal(activa(PROGRAMACION_DEFECTO, new Date("2026-10-18T09:00:00Z")).activo, true);   // domingo 11:00
  assert.equal(activa(PROGRAMACION_DEFECTO, new Date("2026-10-16T21:00:00Z")).activo, false);  // 23:00
});

test("solo los atajos conocidos se aceptan", () => {
  assert.equal(esRapido("r2h"), true);
  assert.equal(esRapido("r9h"), false);
  assert.equal(esRapido("encender"), false);
});
