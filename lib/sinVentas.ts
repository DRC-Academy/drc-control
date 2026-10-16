// Por qué no se pueden contar las ventas: sin token, con el token rechazado o porque no hay alumnos. Puro y sin red.
export type EstadoRespond = { token: boolean; error: string | null };

export function motivoSinVentas(r: EstadoRespond): string {
  if (!r.token) return "falta conectar Respond para saber qué leads acaban comprando (variable RESPONDIO_TOKEN en Vercel).";
  if (r.error) return "Respond no ha devuelto los alumnos (" + r.error + "). Comprueba que el token de RESPONDIO_TOKEN en Vercel sea el vigente y vuelve a desplegar.";
  return "Respond no tiene ningún contacto en la etapa Alumno.";
}
