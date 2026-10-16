import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularSalud, dur, hace, type FilaSalud } from "../lib/estado";

// 16/10/2026 es viernes y Madrid va en UTC+2: 09:00Z son las 11:00, dentro del horario del bot (8:30 a 21:00).
const AHORA = new Date("2026-10-16T09:00:00Z");
const S = Math.floor(AHORA.getTime() / 1000);
const fila = (hace_s: number, r = "ok", extra: Partial<FilaSalud> = {}): FilaSalud => ({ ts: S - hace_s, cid: 1, r, ...extra });
const entrada = (o: Partial<Parameters<typeof calcularSalud>[0]> = {}) => ({
  filas: [] as FilaSalud[], vigilante: null, rescates: null, modo: "propone" as const, ahora: AHORA, ...o,
});

test("el bot apagado en el panel manda sobre todo lo demás", () => {
  const s = calcularSalud(entrada({ modo: "apagado", filas: [fila(60, "fallo"), fila(70, "fallo"), fila(80, "fallo")] }));
  assert.equal(s.nivel, "parado");
  assert.equal(s.titulo, "Bot apagado");
});

test("fuera de horario no se da por roto lo que está dormido", () => {
  const madrugada = calcularSalud(entrada({ ahora: new Date("2026-10-16T05:00:00Z"), vigilante: { estado: "problema", causa: "x" } }));
  assert.equal(madrugada.nivel, "fuera");
  assert.match(madrugada.detalle, /Vuelve a las 8:30/);
  const noche = calcularSalud(entrada({ ahora: new Date("2026-10-16T20:30:00Z"), filas: [fila(30000)] }));
  assert.equal(noche.nivel, "fuera");
  assert.match(noche.detalle, /mañana a las 8:30/);
  assert.match(noche.detalle, /Hoy ha dado 1 sugerencia\./);
});

test("funciona bien: última sugerencia, lo que tarda y las de hoy", () => {
  const s = calcularSalud(entrada({ filas: [fila(600, "ok", { lat: 90 }), fila(120, "ok", { lat: 60 }), fila(3000, "tarde", { lat: 200 })] }));
  assert.equal(s.nivel, "ok");
  assert.equal(s.titulo, "Funciona bien");
  assert.equal(s.hoy, 3);
  assert.equal(s.ultima_s, 120);
  assert.equal(s.detalle, "Última sugerencia hace 2 min · tarda 75 s · 3 hoy");
});

test("sin ningún turno todavía hoy no inventa datos", () => {
  const s = calcularSalud(entrada());
  assert.equal(s.nivel, "ok");
  assert.equal(s.detalle, "Sin mensajes nuevos todavía hoy.");
  assert.equal(s.ultima_s, null);
});

test("el vigilante con un problema vigente se enseña con su causa", () => {
  const s = calcularSalud(entrada({ filas: [fila(60)], vigilante: { estado: "problema", causa: "el modelo kie:x de kie.ai no responde" } }));
  assert.equal(s.nivel, "mal");
  assert.equal(s.titulo, "Con problemas");
  assert.equal(s.detalle, "el modelo kie:x de kie.ai no responde.");
});

test("el vigilante en estado ok no cuenta como problema", () => {
  assert.equal(calcularSalud(entrada({ filas: [fila(60)], vigilante: { estado: "ok" } })).nivel, "ok");
});

test("tres fallos recientes y la mitad o más de los turnos es un problema aunque el vigilante no lo haya visto", () => {
  const malo = calcularSalud(entrada({ filas: [fila(60, "fallo"), fila(120, "fallo"), fila(180, "fallo"), fila(240, "ok", { lat: 50 })] }));
  assert.equal(malo.nivel, "mal");
  assert.equal(malo.detalle, "Las sugerencias están fallando.");
  const pocos = calcularSalud(entrada({ filas: [fila(60, "fallo"), fila(120, "fallo"), fila(180, "ok", { lat: 50 }), fila(240, "ok", { lat: 50 }), fila(300, "ok", { lat: 50 })] }));
  assert.equal(pocos.nivel, "ok", "dos fallos entre cinco turnos no es un problema");
});

test("los fallos de hace más de media hora ya no cuentan", () => {
  const s = calcularSalud(entrada({ filas: [fila(4000, "fallo"), fila(4100, "fallo"), fila(4200, "fallo"), fila(60, "ok", { lat: 40 })] }));
  assert.equal(s.nivel, "ok");
});

test("chats que el vigilante ha avisado como esperando: aviso, con el número", () => {
  const uno = calcularSalud(entrada({ filas: [fila(60)], rescates: { avisadas: { "1:2": "Yon" } } }));
  assert.equal(uno.nivel, "aviso");
  assert.equal(uno.esperando, 1);
  assert.match(uno.detalle, /^1 chat lleva más de lo normal esperando/);
  const dos = calcularSalud(entrada({ filas: [fila(60)], rescates: { avisadas: { "1:2": "Yon", "3:4": "Maria" } } }));
  assert.match(dos.detalle, /^2 chats llevan/);
});

test("los rescates en marcha sin aviso no asustan: la cola de la mañana es normal", () => {
  const s = calcularSalud(entrada({ filas: [fila(60)], rescates: { chats: { "1": { intentos: 1 }, "2": { intentos: 1 } }, avisadas: {} } }));
  assert.equal(s.nivel, "ok");
});

test("va lento con la mediana por encima de 5 minutos y al menos 3 muestras", () => {
  const lento = calcularSalud(entrada({ filas: [fila(60, "ok", { lat: 400 }), fila(120, "ok", { lat: 500 }), fila(180, "ok", { lat: 600 })] }));
  assert.equal(lento.nivel, "aviso");
  assert.equal(lento.titulo, "Va lento");
  assert.equal(lento.detalle, "Las sugerencias tardan 8 min 20 s de media.");
  const dos = calcularSalud(entrada({ filas: [fila(60, "ok", { lat: 900 }), fila(120, "ok", { lat: 900 })] }));
  assert.equal(dos.nivel, "ok", "con dos muestras no se juzga");
});

test("los leads de la noche no cuentan para lo que tarda: ni para la media ni para decir que va lento", () => {
  const noche = calcularSalud(entrada({ filas: [fila(100, "ok", { lat: 35642 }), fila(200, "ok", { lat: 37089 }), fila(300, "ok", { lat: 37935 }), fila(400, "ok", { lat: 90 }), fila(500, "ok", { lat: 120 })] }));
  assert.equal(noche.nivel, "ok");
  assert.equal(noche.lat_s, 105);
  assert.match(noche.detalle, /tarda 1 min 45 s/);
  const solo = calcularSalud(entrada({ filas: [fila(100, "ok", { lat: 35642 }), fila(200, "ok", { lat: 37089 })] }));
  assert.equal(solo.lat_s, null);
  assert.doesNotMatch(solo.detalle, /tarda/);
});

test("formato de tiempos", () => {
  assert.equal(dur(42), "42 s");
  assert.equal(dur(75), "75 s");
  assert.equal(dur(100), "1 min 40 s");
  assert.equal(dur(300), "5 min");
  assert.equal(dur(1200), "20 min");
  assert.equal(hace(30), "hace un momento");
  assert.equal(hace(240), "hace 4 min");
  assert.equal(hace(3600), "hace 1 h");
  assert.equal(hace(4500), "hace 1 h 15 min");
});
