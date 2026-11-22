// Tipos de los datos del juego para la revisión sin compilar (etapa 22, npm run tipos). Viven aquí y no en JSDoc
// dentro de src/ para que no pesen en lo que baja el teléfono.

/** Un logro (hazaña): meta contra valor(g), con su premio. desde: cuenta desde ese día; oculto: no se lista hasta lograrlo. */
export interface Hazana {
  id: string; nombre: string; texto: string; meta: number; valor: (g: any) => number; xp?: number; monedas: number;
  objeto?: string; desde?: string; oculto?: boolean; clase?: string; unidad?: string;
}

/** Tu héroe guardado en localStorage («personaje»). */
export interface Personaje {
  clase?: string | null; nombre?: string; arbol?: Record<string, any>; inventario?: Record<string, number>;
  gastado?: number; puntosCanjeados?: number; equipo?: any; claseHist?: [number, string][]; [k: string]: any;
}

/** Un capítulo de la historia, con sus requisitos [clave, meta] y su jefe. */
export interface Capitulo {
  nombre: string; historia: string; nivel: number; req: [string, number][];
  jefe: { nombre: string; tipo: string; texto: string }; monedas: number; objeto: string; xp: number; xpAntes?: number; [k: string]: any;
}

export interface OpcionesRivales {
  miClase?: string | null; nivel?: number; ftp?: number; peso?: number; factor?: number; dificultad?: string;
  lunes?: string | number; semilla?: string; ritmo?: number | null;
}
export interface OpcionesJuego { ftp?: number; per?: Personaje; ahora?: number; calendario?: any; metaSemanaKm?: number }
export interface OpcionesAtributos {
  ftp?: number; clase?: string | null; ctx?: { racha?: number; mppPromedio?: number; cargaAyer?: number; descansoATiempo?: boolean };
}
