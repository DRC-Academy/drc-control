# drc-control: centro de control del bot de ventas

App interna de DRC Academy (Next.js en Vercel) para ver la salud del bot de ventas, decidir hasta qué fase puede responder solo, seguir el grupo de control, auditar día a día y manejar el panel (modo, fase tope, grupo, programación, reglas de traspaso, correcciones).

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
