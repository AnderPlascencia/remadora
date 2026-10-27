// Vestimenta del héroe y su dibujo vectorial por capas (aura, torso, cabeza, cara).
// rareza: comun | rara | epica | legendaria. Las épicas salen de jefes y las legendarias de hazañas.

export const RAREZAS = {
  comun: { nombre: 'Común', color: '#94A3B8', precio: 60 },
  rara: { nombre: 'Rara', color: '#38BDF8', precio: 180 },
  epica: { nombre: 'Épica', color: '#A78BFA', precio: null },
  legendaria: { nombre: 'Legendaria', color: '#FACC15', precio: null },
};

export const RANURAS = [
  { clave: 'cabeza', nombre: 'Cabeza' },
  { clave: 'cara', nombre: 'Cara' },
  { clave: 'torso', nombre: 'Torso' },
  { clave: 'aura', nombre: 'Aura' },
  { clave: 'bote', nombre: 'Bote' },
];

export const COLECCIONES = [
  { clave: 'basica', nombre: 'Club de remo' },
  { clave: 'vikingo', nombre: 'Vikingo' },
  { clave: 'pirata', nombre: 'Pirata' },
  { clave: 'samurai', nombre: 'Samurái' },
  { clave: 'artico', nombre: 'Explorador ártico' },
  { clave: 'monje', nombre: 'Monje' },
  { clave: 'gladiador', nombre: 'Gladiador' },
  { clave: 'leyenda', nombre: 'Leyendas' },
];

const o = (id, nombre, ranura, rareza, coleccion, extra = {}) => ({ id, nombre, ranura, rareza, coleccion, ...extra });
export const OBJETOS = [
  o('banda-roja', 'Banda roja', 'cabeza', 'comun', 'basica', { color: '#EF4444' }),
  o('banda-azul', 'Banda azul', 'cabeza', 'comun', 'basica', { color: '#3B82F6' }),
  o('gorra-negra', 'Gorra marino', 'cabeza', 'comun', 'basica'),
  o('camiseta-naranja', 'Camiseta naranja', 'torso', 'comun', 'basica', { color: '#F97316' }),
  o('camiseta-azul', 'Camiseta azul', 'torso', 'comun', 'basica', { color: '#2563EB' }),
  o('camiseta-verde', 'Camiseta verde', 'torso', 'comun', 'basica', { color: '#16A34A' }),
  o('lentes', 'Lentes deportivos', 'cara', 'comun', 'basica'),
  o('bote-rojo', 'Bote rojo', 'bote', 'comun', 'basica', { color: '#EF4444' }),
  o('bote-azul', 'Bote azul', 'bote', 'comun', 'basica', { color: '#3B82F6' }),
  o('bote-verde', 'Bote verde', 'bote', 'comun', 'basica', { color: '#22C55E' }),

  o('casco-vikingo', 'Casco vikingo', 'cabeza', 'rara', 'vikingo'),
  o('pechera-piel', 'Pechera de piel', 'torso', 'rara', 'vikingo'),
  o('barba-vikinga', 'Barba trenzada', 'cara', 'rara', 'vikingo'),
  o('panuelo-pirata', 'Pañuelo pirata', 'cabeza', 'rara', 'pirata'),
  o('chaleco-pirata', 'Chaleco de corsario', 'torso', 'rara', 'pirata'),
  o('parche', 'Parche', 'cara', 'rara', 'pirata'),
  o('hachimaki', 'Hachimaki', 'cabeza', 'rara', 'samurai'),
  o('kimono', 'Kimono', 'torso', 'rara', 'samurai'),
  o('gorro-piel', 'Gorro de piel', 'cabeza', 'rara', 'artico'),
  o('parka', 'Parka polar', 'torso', 'rara', 'artico'),
  o('capucha-monje', 'Capucha', 'cabeza', 'rara', 'monje'),
  o('tunica', 'Túnica', 'torso', 'rara', 'monje'),
  o('casco-gladiador', 'Casco de gladiador', 'cabeza', 'rara', 'gladiador'),
  o('pintura-guerra', 'Pintura de guerra', 'cara', 'rara', 'gladiador'),

  o('casco-cuernos-oro', 'Casco de cuernos de oro', 'cabeza', 'epica', 'vikingo'),
  o('sombrero-capitan', 'Sombrero de capitán', 'cabeza', 'epica', 'pirata'),
  o('kabuto', 'Kabuto', 'cabeza', 'epica', 'samurai'),
  o('corona-hielo', 'Corona de hielo', 'cabeza', 'epica', 'artico'),
  o('armadura-gladiador', 'Armadura de bronce', 'torso', 'epica', 'gladiador'),

  o('aura-fuego', 'Aura de fuego', 'aura', 'legendaria', 'leyenda', { color: '#F97316' }),
  o('aura-hielo', 'Aura de hielo', 'aura', 'legendaria', 'leyenda', { color: '#38BDF8' }),
  o('aura-dorada', 'Aura dorada', 'aura', 'legendaria', 'leyenda', { color: '#FACC15' }),
  o('bote-dorado', 'Bote dorado', 'bote', 'legendaria', 'leyenda', { color: '#FACC15' }),
  o('capa-leyenda', 'Capa de leyenda', 'torso', 'legendaria', 'leyenda'),
  o('cinta-campeon', 'Cinta de campeón', 'cabeza', 'legendaria', 'leyenda', { color: '#FACC15' }),
];
export const objeto = (id) => OBJETOS.find((x) => x.id === id) || null;
export const precioDe = (x) => RAREZAS[x.rareza].precio;

export const PIELES = ['#F5D0B5', '#E8B48F', '#C68A5E', '#8D5A3B', '#5B3A29'];

// ---------- Dibujo ----------
const CUERPO = 'M28 200 C28 152 60 134 100 134 C140 134 172 152 172 200 Z';
const DOMO = 'M64 76 C64 38 136 38 136 76 Z';

const TORSOS = {
  base: () => `<path d="${CUERPO}" fill="#64748B"/><path d="M86 136 Q100 148 114 136" fill="none" stroke="#475569" stroke-width="4"/>`,
  camiseta: (x) => `<path d="${CUERPO}" fill="${x.color}"/><path d="M86 136 Q100 148 114 136" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="4"/>`,
  'pechera-piel': () => `<path d="${CUERPO}" fill="#7C4A2D"/><path d="M40 170 L160 150" stroke="#3F2414" stroke-width="7"/>
    <path d="M62 146 q8 -10 16 0 q8 -10 16 0 q8 -10 16 0 q8 -10 16 0 q8 -10 16 0 l0 8 l-80 0z" fill="#E7D3B5"/>`,
  'chaleco-pirata': () => `<path d="${CUERPO}" fill="#F1F5F9"/><path d="M28 200 C28 152 60 134 86 134 L96 200 Z" fill="#991B1B"/>
    <path d="M172 200 C172 152 140 134 114 134 L104 200 Z" fill="#991B1B"/><circle cx="90" cy="168" r="3" fill="#FACC15"/><circle cx="110" cy="168" r="3" fill="#FACC15"/>`,
  kimono: () => `<path d="${CUERPO}" fill="#1E3A8A"/><path d="M84 134 L116 200" stroke="#F8FAFC" stroke-width="8"/><path d="M116 134 L98 172" stroke="#F8FAFC" stroke-width="8"/>
    <rect x="28" y="182" width="144" height="10" fill="#B91C1C"/>`,
  parka: () => `<path d="${CUERPO}" fill="#0EA5E9"/><path d="M36 168 H164 M32 186 H168" stroke="rgba(255,255,255,.35)" stroke-width="3"/>
    <path d="M60 144 q8 -12 16 0 q8 -12 16 0 q8 -12 16 0 q8 -12 16 0 q8 -12 16 0 l0 8 l-80 0z" fill="#F8FAFC"/>`,
  tunica: () => `<path d="${CUERPO}" fill="#EA580C"/><path d="M70 138 L132 200" stroke="#7C2D12" stroke-width="12"/>`,
  'armadura-gladiador': () => `<path d="${CUERPO}" fill="#B45309"/><path d="M60 160 H140 M54 178 H146" stroke="#78350F" stroke-width="4"/>
    <circle cx="100" cy="170" r="12" fill="#FCD34D" stroke="#78350F" stroke-width="3"/><path d="M40 150 C46 140 60 136 70 138 L66 156Z M160 150 C154 140 140 136 130 138 L134 156Z" fill="#FCD34D"/>`,
  'capa-leyenda': () => `<path d="M14 200 C18 140 50 120 100 120 C150 120 182 140 186 200 Z" fill="#6D28D9"/><path d="${CUERPO}" fill="#312E81"/>
    <path d="M70 136 L100 170 L130 136" fill="none" stroke="#FACC15" stroke-width="6"/><circle cx="100" cy="170" r="6" fill="#FACC15"/>`,
};

const CABEZAS = {
  banda: (x) => `<rect x="64" y="58" width="72" height="11" rx="5" fill="${x.color}"/>`,
  'cinta-campeon': () => `<rect x="64" y="58" width="72" height="11" rx="5" fill="#FACC15"/><path d="M134 62 l14 -6 l-4 10 l6 8 l-14 -2z" fill="#FACC15"/>`,
  'gorra-negra': () => `<path d="${DOMO}" fill="#1E3A8A"/><path d="M100 70 L152 74 Q150 82 100 78 Z" fill="#172554"/><path d="M100 40 V72" stroke="#3B82F6" stroke-width="3"/><circle cx="100" cy="40" r="4" fill="#3B82F6"/>`,
  'casco-vikingo': () => cascoVikingo('#94A3B8', '#F5F5F4'),
  'casco-cuernos-oro': () => cascoVikingo('#CA8A04', '#FDE68A'),
  'panuelo-pirata': () => `<path d="M62 76 C62 40 138 40 138 76 Z" fill="#DC2626"/><circle cx="86" cy="56" r="3" fill="#fff"/><circle cx="104" cy="50" r="3" fill="#fff"/><circle cx="120" cy="60" r="3" fill="#fff"/>
    <path d="M136 66 l18 -6 l-6 14 z M136 70 l16 10 l-14 2z" fill="#B91C1C"/>`,
  'sombrero-capitan': () => `<path d="M46 66 Q100 14 154 66 Q100 50 46 66Z" fill="#111827"/><path d="M46 66 Q100 50 154 66" fill="none" stroke="#FACC15" stroke-width="4"/>
    <circle cx="100" cy="44" r="7" fill="#F8FAFC"/><path d="M96 44h.1M104 44h.1" stroke="#111827" stroke-width="3" stroke-linecap="round"/>`,
  hachimaki: () => `<rect x="64" y="58" width="72" height="12" rx="4" fill="#F8FAFC"/><circle cx="100" cy="64" r="5" fill="#DC2626"/><path d="M134 64 l16 -8 M134 66 l14 8" stroke="#F8FAFC" stroke-width="4" stroke-linecap="round"/>`,
  kabuto: () => `<path d="M60 78 C60 36 140 36 140 78 Z" fill="#1F2937"/><path d="M52 80 L64 66 L136 66 L148 80 Z" fill="#374151"/>
    <path d="M100 48 L76 14 M100 48 L124 14" stroke="#FACC15" stroke-width="6" stroke-linecap="round"/><circle cx="100" cy="50" r="6" fill="#FACC15"/>`,
  'gorro-piel': () => `<path d="M60 74 C56 20 144 20 140 74 Z" fill="#92400E"/><path d="M76 34 l4 10 M96 28 l2 10 M116 30 l-2 10 M128 40 l-4 8" stroke="#B45309" stroke-width="4" stroke-linecap="round"/>
    <path d="M56 78 q11 -12 22 0 q11 -12 22 0 q11 -12 22 0 q11 -12 22 0 l0 6 l-88 0z" fill="#F5F5F4"/>`,
  'corona-hielo': () => `<path d="M66 66 L72 36 L86 54 L100 26 L114 54 L128 36 L134 66 Z" fill="#BAE6FD" stroke="#0EA5E9" stroke-width="3" stroke-linejoin="round"/>`,
  'capucha-monje': () => `<path d="M56 124 C46 58 70 32 100 32 C130 32 154 58 144 124 L130 124 C136 72 122 52 100 52 C78 52 64 72 70 124 Z" fill="#78350F"/>`,
  'casco-gladiador': () => `<path d="M62 80 C62 40 138 40 138 80 Z" fill="#B45309"/><path d="M70 40 Q100 4 130 40" fill="none" stroke="#DC2626" stroke-width="12" stroke-linecap="round"/>
    <rect x="96" y="66" width="8" height="16" rx="3" fill="#78350F"/>`,
};

function cascoVikingo(metal, cuerno) {
  return `<path d="M66 64 C46 60 38 42 44 26 C52 42 60 48 72 52 Z" fill="${cuerno}"/><path d="M134 64 C154 60 162 42 156 26 C148 42 140 48 128 52 Z" fill="${cuerno}"/>
    <path d="${DOMO}" fill="${metal}"/><rect x="62" y="68" width="76" height="10" rx="4" fill="#78716C"/><path d="M100 40 V70" stroke="rgba(0,0,0,.25)" stroke-width="5"/>`;
}

const CARAS = {
  lentes: () => `<rect x="76" y="78" width="22" height="13" rx="5" fill="#0F172A"/><rect x="102" y="78" width="22" height="13" rx="5" fill="#0F172A"/><path d="M98 84 H102 M66 82 H76 M124 82 H134" stroke="#0F172A" stroke-width="3"/>
    <path d="M80 82 l6 0" stroke="#38BDF8" stroke-width="2"/>`,
  parche: () => `<path d="M66 70 L134 98" stroke="#111827" stroke-width="3"/><circle cx="112" cy="86" r="9" fill="#111827"/>`,
  'barba-vikinga': () => `<path d="M70 92 C70 120 84 134 100 134 C116 134 130 120 130 92 C122 104 112 108 100 108 C88 108 78 104 70 92 Z" fill="#B45309"/>
    <path d="M94 128 v14 M106 128 v14" stroke="#92400E" stroke-width="5" stroke-linecap="round"/>`,
  'pintura-guerra': () => `<path d="M76 94 L92 96 M108 96 L124 94 M78 100 L92 101 M108 101 L122 100" stroke="#2563EB" stroke-width="4" stroke-linecap="round"/>`,
};

function aura(x) {
  if (!x) return '';
  return `<defs><radialGradient id="aura-${x.id}"><stop offset="0" stop-color="${x.color}" stop-opacity=".9"/><stop offset=".7" stop-color="${x.color}" stop-opacity=".25"/><stop offset="1" stop-color="${x.color}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="100" cy="100" r="98" fill="url(#aura-${x.id})"/>`;
}

// Solo el aura equipada (va detrás de la ilustración del personaje).
export const auraHeroe = ({ equipo = {} } = {}) => aura(objeto(equipo.aura));

// SVG del héroe con lo que tiene puesto. equipo: { cabeza, cara, torso, aura }, piel: índice de PIELES.
export function dibujarHeroe({ equipo = {}, piel = 1 } = {}, { tam = 160 } = {}) {
  const tono = PIELES[piel] || PIELES[1];
  const de = (r) => objeto(equipo[r]);
  const torso = de('torso');
  const cab = de('cabeza');
  const cara = de('cara');
  const tapaPelo = cab && !['banda-roja', 'banda-azul', 'hachimaki', 'cinta-campeon'].includes(cab.id);
  const fTorso = torso ? (TORSOS[torso.id] || (torso.color ? TORSOS.camiseta : TORSOS.base)) : TORSOS.base;
  const fCab = cab ? (CABEZAS[cab.id] || (cab.color ? CABEZAS.banda : null)) : null;
  return `<svg viewBox="0 0 200 200" width="${tam}" height="${tam}" role="img" aria-label="Tu héroe">
    ${aura(de('aura'))}
    ${fTorso(torso || {})}
    <rect x="88" y="108" width="24" height="30" rx="8" fill="${tono}"/>
    <circle cx="66" cy="86" r="8" fill="${tono}"/><circle cx="134" cy="86" r="8" fill="${tono}"/>
    <ellipse cx="100" cy="82" rx="34" ry="38" fill="${tono}"/>
    ${tapaPelo ? '' : '<path d="M66 80 C62 46 84 38 100 38 C118 38 140 46 134 80 C128 62 116 56 100 56 C84 56 72 62 66 80Z" fill="#2B1B12"/>'}
    <path d="M82 76 L92 74 M108 74 L118 76" stroke="#2B1B12" stroke-width="3" stroke-linecap="round"/>
    <circle cx="88" cy="86" r="4" fill="#1F2937"/><circle cx="112" cy="86" r="4" fill="#1F2937"/>
    <path d="M90 102 Q100 110 110 102" fill="none" stroke="#7F1D1D" stroke-width="3" stroke-linecap="round"/>
    ${cara ? (CARAS[cara.id]?.(cara) || '') : ''}
    ${fCab ? fCab(cab) : ''}
  </svg>`;
}
