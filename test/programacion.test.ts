import { test } from "node:test";
import assert from "node:assert/strict";
import { activa, caeFueraDeHorario, sigueVigente, describir, type Programacion } from "../lib/programacion";

// Octubre de 2026: hasta el 25 Madrid va en UTC+2. El 16/10 es viernes, el 17 sábado, el 18 domingo, el 19 lunes.
const z = "Europe/Madrid" as const;
const d = (iso: string) => new Date(iso);
const act = (pr: Programacion, iso: string) => activa(pr, d(iso)).activo;

test("ventana con fecha y hora de inicio y de fin", () => {
  const pr: Programacion = { tipo: "ventana", desde: "2026-10-16T08:00:00Z", hasta: "2026-10-16T12:00:00Z", zona: z };
  assert.equal(act(pr, "2026-10-16T07:59:00Z"), false);
  assert.match(activa(pr, d("2026-10-16T07:59:00Z")).motivo, /empieza/);
  assert.equal(act(pr, "2026-10-16T08:00:00Z"), true);
  assert.equal(act(pr, "2026-10-16T11:59:00Z"), true);
  assert.equal(act(pr, "2026-10-16T12:00:00Z"), false);
  assert.match(activa(pr, d("2026-10-16T12:00:00Z")).motivo, /terminó/);
});

test("todos los días de 10:00 a 14:00 (hora de Madrid)", () => {
  const pr: Programacion = { tipo: "franjas", franjas: [{ dias: [1, 2, 3, 4, 5, 6, 7], desde: "10:00", hasta: "14:00" }], zona: z };
  assert.equal(act(pr, "2026-10-16T08:59:00Z"), true); // 10:59 Madrid
  assert.equal(act(pr, "2026-10-16T07:59:00Z"), false); // 09:59 Madrid
  assert.equal(act(pr, "2026-10-16T08:00:00Z"), true); // 10:00 Madrid
  assert.equal(act(pr, "2026-10-16T11:59:00Z"), true); // 13:59
  assert.equal(act(pr, "2026-10-16T12:00:00Z"), false); // 14:00
  assert.equal(act(pr, "2026-10-18T09:00:00Z"), true); // domingo 11:00
});

test("franja nocturna de 21:00 a 08:30 de lunes a viernes cruza la medianoche", () => {
  const pr: Programacion = { tipo: "franjas", franjas: [{ dias: [1, 2, 3, 4, 5], desde: "21:00", hasta: "08:30" }], zona: z };
  assert.equal(act(pr, "2026-10-16T19:00:00Z"), true); // viernes 21:00
  assert.equal(act(pr, "2026-10-16T18:59:00Z"), false); // viernes 20:59
  assert.equal(act(pr, "2026-10-17T01:00:00Z"), true); // sábado 03:00: sigue la franja del viernes
  assert.equal(act(pr, "2026-10-17T06:29:00Z"), true); // sábado 08:29
  assert.equal(act(pr, "2026-10-17T06:30:00Z"), false); // sábado 08:30
  assert.equal(act(pr, "2026-10-17T20:00:00Z"), false); // sábado 22:00: el sábado no está marcado
  assert.equal(act(pr, "2026-10-19T05:00:00Z"), false); // lunes 07:00: el domingo no está marcado
  assert.equal(act(pr, "2026-10-19T20:00:00Z"), true); // lunes 22:00
});

test("hasta 00:00 es el final del día", () => {
  const pr: Programacion = { tipo: "franjas", franjas: [{ dias: [1, 2, 3, 4, 5, 6, 7], desde: "18:00", hasta: "00:00" }], zona: z };
  assert.equal(act(pr, "2026-10-16T21:59:00Z"), true); // 23:59 Madrid
  assert.equal(act(pr, "2026-10-16T22:00:00Z"), false); // 00:00 del sábado
  assert.equal(act(pr, "2026-10-16T15:59:00Z"), false); // 17:59
});

test("00:00 a 00:00 es el día entero (fin de semana)", () => {
  const pr: Programacion = { tipo: "franjas", franjas: [{ dias: [6, 7], desde: "00:00", hasta: "00:00" }], zona: z };
  assert.equal(act(pr, "2026-10-16T21:59:00Z"), false); // viernes 23:59
  assert.equal(act(pr, "2026-10-16T22:00:00Z"), true); // sábado 00:00
  assert.equal(act(pr, "2026-10-17T21:59:00Z"), true); // sábado 23:59
  assert.equal(act(pr, "2026-10-18T21:59:00Z"), true); // domingo 23:59
  assert.equal(act(pr, "2026-10-18T22:00:00Z"), false); // lunes 00:00
  assert.match(describir(pr), /sábado y domingo, todo el día/);
});

test("varias franjas en el mismo día", () => {
  const pr: Programacion = { tipo: "franjas", franjas: [{ dias: [5], desde: "10:00", hasta: "14:00" }, { dias: [5], desde: "16:00", hasta: "20:00" }], zona: z };
  assert.equal(act(pr, "2026-10-16T09:00:00Z"), true); // 11:00
  assert.equal(act(pr, "2026-10-16T13:00:00Z"), false); // 15:00
  assert.equal(act(pr, "2026-10-16T15:00:00Z"), true); // 17:00
  assert.equal(act(pr, "2026-10-17T15:00:00Z"), false); // sábado
});

test("hasta, siempre, apagado y tipos desconocidos", () => {
  assert.equal(act({ tipo: "hasta", hasta: "2026-10-16T12:00:00Z", zona: z }, "2026-10-16T11:00:00Z"), true);
  assert.equal(act({ tipo: "hasta", hasta: "2026-10-16T12:00:00Z", zona: z }, "2026-10-16T12:00:00Z"), false);
  assert.equal(act({ tipo: "siempre", zona: z }, "2026-10-16T12:00:00Z"), true);
  assert.equal(act({ tipo: "apagado", zona: z }, "2026-10-16T12:00:00Z"), false);
  assert.equal(act({ tipo: "otra" as never, zona: z }, "2026-10-16T12:00:00Z"), false);
  assert.equal(act({ tipo: "franjas", franjas: [{ dias: [5], desde: "mal", hasta: "14:00" }], zona: z }, "2026-10-16T09:00:00Z"), false);
});

test("avisa si la programación cae fuera del horario del bot (8:30 a 21:00)", () => {
  const ahora = d("2026-10-16T09:00:00Z");
  assert.equal(caeFueraDeHorario({ tipo: "franjas", franjas: [{ dias: [5], desde: "10:00", hasta: "14:00" }], zona: z }, ahora), false);
  assert.equal(caeFueraDeHorario({ tipo: "franjas", franjas: [{ dias: [5], desde: "08:30", hasta: "21:00" }], zona: z }, ahora), false);
  assert.equal(caeFueraDeHorario({ tipo: "franjas", franjas: [{ dias: [5], desde: "08:00", hasta: "12:00" }], zona: z }, ahora), true);
  assert.equal(caeFueraDeHorario({ tipo: "franjas", franjas: [{ dias: [5], desde: "21:00", hasta: "08:30" }], zona: z }, ahora), true);
  assert.equal(caeFueraDeHorario({ tipo: "ventana", desde: "2026-10-16T07:00:00Z", hasta: "2026-10-16T10:00:00Z", zona: z }, ahora), false); // 09:00 a 12:00
  assert.equal(caeFueraDeHorario({ tipo: "ventana", desde: "2026-10-16T07:00:00Z", hasta: "2026-10-16T20:30:00Z", zona: z }, ahora), true); // hasta 22:30
  assert.equal(caeFueraDeHorario({ tipo: "hasta", hasta: "2026-10-16T10:00:00Z", zona: z }, ahora), false);
  assert.equal(caeFueraDeHorario({ tipo: "siempre", zona: z }, ahora), false);
});

test("sigueVigente y descripción", () => {
  const ahora = d("2026-10-16T09:00:00Z");
  assert.equal(sigueVigente({ tipo: "apagado", zona: z }, ahora), false);
  assert.equal(sigueVigente({ tipo: "ventana", desde: "2026-10-15T08:00:00Z", hasta: "2026-10-15T10:00:00Z", zona: z }, ahora), false);
  assert.equal(sigueVigente({ tipo: "ventana", desde: "2026-10-16T08:00:00Z", hasta: "2026-10-16T10:00:00Z", zona: z }, ahora), true);
  assert.equal(sigueVigente({ tipo: "siempre", zona: z }, ahora), true);
  assert.match(describir({ tipo: "franjas", franjas: [{ dias: [1, 2, 3, 4, 5, 6, 7], desde: "10:00", hasta: "14:00" }], zona: z }), /todos los días de 10:00 a 14:00/);
  assert.match(describir({ tipo: "franjas", franjas: [{ dias: [1, 2, 3, 4, 5], desde: "21:00", hasta: "08:30" }], zona: z }), /de lunes a viernes de 21:00 a 08:30 \(cruza la medianoche\)/);
  assert.match(describir({ tipo: "ventana", desde: "2026-10-16T08:00:00Z", hasta: "2026-10-16T12:00:00Z", zona: z }), /^Del 16\/10 10:00 al 16\/10 14:00$/);
});
