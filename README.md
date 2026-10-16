# drc-control: centro de control del bot de ventas

App interna de DRC Academy (Next.js en Vercel) para ver la salud del bot de ventas, decidir hasta qué fase puede responder solo, seguir el grupo de control, auditar día a día y manejar el panel (modo, fase tope, grupo, programación, reglas de traspaso, correcciones).

## Pantalla principal y Ajustes (16/10/2026)

La portada (`/`) es una sola pantalla pensada para el móvil, con lo esencial de un vistazo:
1. **Estado del bot**: funciona bien, va lento, con problemas, fuera de horario o apagado. Sale de lo que deja el bot en la rama `estado` (`salud/AAAA-MM-DD.jsonl`, `vigilante.json`, `rescates.json`) y se calcula en `lib/estado.ts` (puro, con tests). Si no puede leerlo, lo dice en vez de dar el bot por sano.
2. **Respuestas automáticas**: interruptor, atajos (1 hora, 2 horas, 4 horas, hoy, fin de semana) y enlace a la programación. Encender pide confirmación; apagar no. Usa lo guardado en Ajustes (grupo, fase tope, programación).
3. **Cierre**: leads que acaban comprando (hoy son Alumno en Respond) entre los de los últimos 28 días. Con el modo autónomo en marcha compara al bot solo con el grupo de control (`lib/resumen.ts`).
4. **Dónde se pierden los leads**: embudo con el paso donde más se cae marcado, y cuánto tarda una persona en contestar frente al límite de 10 minutos.

`/ajustes` reúne lo demás: programación completa (horario semanal, hasta una fecha, entre dos fechas, siempre, parada), fase tope y grupo, reglas de traspaso, correcciones al bot, historial, apagar el bot por completo y enlaces al análisis detallado (`/salud`, `/preparacion`, `/grupo`, `/auditoria`, `/comparar`), que siguen como estaban. `/panel` redirige a `/ajustes`.

La pantalla se refresca sola cada minuto. Pruebas: `npm test` (programación, estado, cierre, embudo y atajos).


Sin base de datos: el estado del panel y las métricas viven en la rama `estado` del repositorio del bot (`drcacademycourses/drc-respond`). La app lee `metricas/*.jsonl` y escribe `control.json`, `control-historial.json` y `control-correcciones.json` con commits. El bot deja su acuse en `control-aplicado.json`. Git es el registro.

## Variables de entorno (en Vercel, Settings, Environment Variables)

- `GITHUB_TOKEN` (obligatoria): token fino de GitHub con acceso solo al repositorio `drcacademycourses/drc-respond` y permiso Contents de lectura y escritura. Se crea en GitHub: Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token; Resource owner `drcacademycourses`; Repository access: Only select repositories, `drc-respond`; Permissions, Repository permissions, Contents: Read and write; caducidad de un año.
- `CLAVE_MANDOS` (obligatoria): clave con la que se entra para cambiar el panel.
- `CLAVE_VISTA` (obligatoria): clave con la que se entra solo para mirar.
- `RESPONDIO_TOKEN` (opcional): token de la Developer API de Respond, solo lectura; con él, los contactos que hoy son Alumno cuentan como venta en el embudo.
- `REPO_BOT` y `RAMA_ESTADO` (opcionales): por defecto `drcacademycourses/drc-respond` y `estado`.

## Desplegar

1. En Vercel: Add New, Project, Import desde GitHub, `DRC-Academy/drc-control`. Framework Next.js, sin cambios.
2. Pegar las variables de entorno de arriba y desplegar (o volver a desplegar tras pegarlas).
3. Entrar en https://drc-control.vercel.app con la clave de mandos.

Cada push a `main` se despliega solo.

## Cómo lo lee el bot

El bot (`copiloto.py`) lee `control.json` de la rama `estado` en cada evento y en cada ronda. Esquema y reglas: documento "Bot hibrido - centro de control y plan de transicion - 14 oct 2026" en la carpeta de proyecto de DRC Academy (active/). Mientras el modo autónomo no esté construido en el bot, lo que guarda el panel es la orden que Claude aplica.

## En local

```bash
npm install
cp .env.example .env.local   # y rellenar
npm run dev
```

## Respuestas automáticas y programación (15/10/2026)

El panel tiene un botón para encender y apagar las respuestas automáticas, y la programación admite: la próxima hora, 2 o 4 horas, hasta las 21:00 de hoy, el fin de semana entero, un tramo entre dos fechas con hora (ventana), un horario por días con hasta 3 franjas (también de noche, cruzando la medianoche) y siempre. Todo en hora de Madrid. Encender pide marcar una casilla de confirmación.

Encender el panel NO hace que el bot envíe mensajes: el envío real lo bloquea el interruptor de seguridad COPILOTO_AUTONOMO del repositorio del bot, que solo se pone en activo en GitHub por decisión de Diego. Con el valor prueba, el bot solo deja el comentario Habría enviado. El panel enseña ese estado con el acuse del bot (control-aplicado.json).

La lógica de horarios está en lib/programacion.ts y tiene pruebas (npm test). Debe dar el mismo resultado que programacion_activa del bot (drc-respond, copiloto.py).
