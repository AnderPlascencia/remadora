// I-3 (N5 de la ronda 2): el objeto usado en una sesión se descuenta una sola vez. Las fechas de las sesiones ya
// descontadas van en el mismo personaje (una sola escritura): descontar dos veces la misma no hace nada. Se guardan
// las de 30 días. Si la app se cierra después de guardar la sesión (que lleva `gasto: 1`) y antes de descontarlo,
// se descuenta al volver a abrirla.
import * as H from '../historial.js';
import { guardarPersonaje, leerPersonaje } from './heroe.js';

export function gastarObjeto(s) {
  const per = leerPersonaje();
  const gastos = (per.gastos || []).filter((f) => f > Date.now() - 30 * 864e5);
  if (gastos.includes(s.fecha)) return;
  const inv = per.inventario || {};
  guardarPersonaje({ inventario: { ...inv, [s.ventajaUsada]: Math.max(0, (inv[s.ventajaUsada] || 0) - 1) }, gastos: [...gastos, s.fecha] });
}

// Al abrir la app: las sesiones de la última semana que se guardaron sin descontar su objeto.
export async function descontarPendientes() {
  for (const s of await H.sinMuestras()) if (s.gasto && s.ventajaUsada && s.fecha > Date.now() - 7 * 864e5) gastarObjeto(s);
}
