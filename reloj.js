// Reloj de la sesión: cuántos segundos enteros pasaron desde el último tic, según la hora del sistema.
// Con la app en segundo plano Chrome frena los temporizadores (hasta uno por minuto), así que contar tics
// perdía tiempo y metros. El reloj devuelve los segundos pendientes (con tope) y conserva la fracción
// para que el siguiente tic no se corra. Si la hora del sistema va hacia atrás, vuelve a empezar desde ahí.
export const MAX_SEG_PENDIENTES = 3 * 3600;

export function crearReloj(inicio = Date.now(), max = MAX_SEG_PENDIENTES) {
  let previo = inicio;
  return (ahora = Date.now()) => {
    if (ahora < previo) { previo = ahora; return 0; }
    const n = Math.floor((ahora - previo) / 1000);
    if (n > max) { previo = ahora; return max; }
    previo += n * 1000;
    return n;
  };
}
