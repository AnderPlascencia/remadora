// Técnica (etapa 12, fórmula del entrenador): regularidad de la potencia palada a palada y cadencia estable.
// Las muestras van a 1 por segundo y la consola ya da la media de cada palada, así que se miran ventanas de 30 s:
// - se quitan los primeros 20 s de cada bloque (la consola tarda 4 o 5 paladas en estabilizarse) y los bloques de
//   menos de 60 s (sprints, arranques, 30/15: ahí la potencia sube y baja a propósito), además de los descansos;
// - una ventana vale si no tiene huecos ni paladas a 0 y va por encima del 55 % del FTP (sin FTP, del 70 % de la
//   mediana de vatios de la sesión), para no premiar remar flojo;
// - es «técnica» si el coeficiente de variación de los vatios es ≤ 8 % y la desviación de la cadencia es ≤ 1,5
//   golpes/min o ≤ 6 % de su media (lo mayor); si el bloque pide una cadencia, además tiene que caer en ese rango.
// Puntos: 0,6 por minuto técnico, con tope de 30 min (un fondo largo y suave no la dispara), y +3 si el 70 % o más
// de las ventanas son técnicas en una sesión de 10 min o más.
export const VENTANA_S = 30;
export const QUITAR_INICIO_S = 20;
export const BLOQUE_MIN_S = 60;
export const CV_MAX = 0.08;
export const SPM_DESV_MAX = 1.5;
export const SPM_DESV_REL = 0.06;
export const PUNTOS_MIN = 0.6;
export const TOPE_MIN = 30;
export const BONO = 3;
export const BONO_PCT = 0.7;

const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const desv = (v, m = media(v)) => Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
const mediana = (v) => {
  const o = [...v].sort((a, b) => a - b);
  const k = o.length >> 1;
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
};
// Cadencia pedida por un bloque: [min, max] o null.
const cadenciaPedida = (b) => (b?.spmMeta ? b.spmMeta : b?.metrica === 'spm' ? [b.min, b.max ?? b.min] : null);

// Tramos [desde, hasta) en segundos de sesión con su bloque; sin bloques, toda la sesión es un tramo.
function tramos(s) {
  const fin = s.muestras.at(-1)?.t || 0;
  if (!s.bloques?.length) return [{ desde: 0, hasta: fin, b: null }];
  const out = [];
  let t = 0;
  for (const b of s.bloques) {
    const d = b.duracion || 0;
    // Los descansos (bloques sin métrica) no cuentan.
    if (b.metrica && d >= BLOQUE_MIN_S) out.push({ desde: t, hasta: t + d, b });
    t += d;
  }
  return out;
}

// { ventanas, tecnicas, minutos (técnicos, con tope), pct, puntos }.
export function tecnicaDeSesion(s, ftp = 0) {
  const vacio = { ventanas: 0, tecnicas: 0, minutos: 0, pct: 0, puntos: 0 };
  const m = s?.muestras;
  if (!m?.length) return vacio;
  const f = s.ftp || ftp;
  const conPotencia = m.filter((x) => x.w > 0).map((x) => x.w);
  if (!conPotencia.length) return vacio;
  const minimo = f ? 0.55 * f : 0.7 * mediana(conPotencia);
  const porT = new Map(m.map((x) => [x.t, x]));
  let ventanas = 0;
  let tecnicas = 0;
  for (const { desde, hasta, b } of tramos(s)) {
    const pedida = cadenciaPedida(b);
    for (let t0 = desde + QUITAR_INICIO_S; t0 + VENTANA_S <= hasta; t0 += VENTANA_S) {
      const v = [];
      for (let t = t0 + 1; t <= t0 + VENTANA_S; t++) {
        const x = porT.get(t);
        if (!x || !(x.w > 0) || !(x.spm > 0)) break;
        v.push(x);
      }
      if (v.length < VENTANA_S) continue; // hueco o paladas a 0: no se mira
      const w = v.map((x) => x.w);
      const mw = media(w);
      if (mw < minimo) continue;
      ventanas++;
      const spm = v.map((x) => x.spm);
      const ms = media(spm);
      const regular = desv(w, mw) / mw <= CV_MAX && desv(spm, ms) <= Math.max(SPM_DESV_MAX, SPM_DESV_REL * ms);
      if (regular && (!pedida || (ms >= pedida[0] && ms <= pedida[1]))) tecnicas++;
    }
  }
  const minutos = Math.min(TOPE_MIN, (tecnicas * VENTANA_S) / 60);
  const pct = ventanas ? tecnicas / ventanas : 0;
  const activos = m.filter((x) => x.w > 0 || x.spm > 0).length;
  const bono = pct >= BONO_PCT && activos >= 600 ? BONO : 0;
  return { ventanas, tecnicas, minutos, pct, puntos: minutos * PUNTOS_MIN + bono };
}
