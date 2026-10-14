export function GET() {
  return Response.json({ ok: true, hora: new Date().toISOString() });
}
