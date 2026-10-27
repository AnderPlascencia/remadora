// Datos fijos del sistema de personajes: clases, rangos, paletas y formato de exportación.
// Fuente única para el generador, los scripts de validación y el manifiesto.

export const VERSION_MAESTRO = '3.0.0';

// 9 rangos de la lámina de referencia; se sube de rango cada 10 niveles.
export const RANGOS = [
  { id: 'novato', nombre: 'Novato', lema: 'Inexperto', edad: '18–20', nivel: 1 },
  { id: 'aprendiz', nombre: 'Aprendiz', lema: 'En formación', edad: '20–24', nivel: 10 },
  { id: 'combatiente', nombre: 'Combatiente', lema: 'En acción', edad: '24–28', nivel: 20 },
  { id: 'guerrero', nombre: 'Guerrero', lema: 'Con experiencia', edad: '28–33', nivel: 30 },
  { id: 'veterano', nombre: 'Veterano', lema: 'Conocido', edad: '33–38', nivel: 40 },
  { id: 'campeon', nombre: 'Campeón', lema: 'Dominio', edad: '38–43', nivel: 50 },
  { id: 'elite', nombre: 'Élite', lema: 'Distinguido', edad: '43–50', nivel: 60 },
  { id: 'maestro', nombre: 'Maestro', lema: 'Leyenda local', edad: '50–57', nivel: 70 },
  { id: 'legendario', nombre: 'Legendario', lema: 'Inmortal', edad: '57–65', nivel: 80 },
];
export const rangoPorNivel = (nivel) => RANGOS[Math.min(RANGOS.length - 1, Math.floor(Math.max(1, nivel) / 10))];

// Paleta por clase: piel y pelo fijos (invariantes de identidad) + roles de material.
export const CLASES = {
  vikingo: {
    nombre: 'Vikingo', atributo: 'fuerza', piel: '#F1C3A0', pelo: '#C2551C',
    paleta: { tela: '#7C6A55', cuero: '#6B4E37', metal: '#9AA3AD', acento: '#B48B5C', insignia: '#E0B44A' },
  },
  pirata: {
    nombre: 'Pirata', atributo: 'agilidad', piel: '#D9A27A', pelo: '#2A1B12',
    paleta: { tela: '#E6DAC0', cuero: '#6B4423', metal: '#C9A227', acento: '#B3261E', insignia: '#E0B44A' },
  },
  samurai: {
    nombre: 'Samurái', atributo: 'tecnica', piel: '#EBC08F', pelo: '#151515',
    paleta: { tela: '#BFA77A', cuero: '#3B3026', metal: '#2A2A2A', acento: '#9E2A22', insignia: '#C9A227' },
  },
  polinesio: {
    nombre: 'Polinesio', atributo: 'resistencia', piel: '#A86E46', pelo: '#1B120C',
    paleta: { tela: '#C9A86A', cuero: '#7A5536', metal: '#F2EEE4', acento: '#C62828', insignia: '#F9C74F' },
  },
  romano: {
    nombre: 'Romano', atributo: 'voluntad', piel: '#DDA47A', pelo: '#3A2416',
    paleta: { tela: '#D9CFB8', cuero: '#6B4423', metal: '#C9963A', acento: '#B3261E', insignia: '#E0B44A' },
  },
};

// Formato de exportación de imágenes estáticas.
export const FORMATO = {
  viewBox: [-30, -2, 360, 420],      // lienzo del SVG fuente (unidades)
  cuerpo: { ancho: 720, alto: 840 },  // PNG de cuerpo entero (escala 2x)
  retrato: { ancho: 256, alto: 256 }, // PNG de retrato (cabeza y hombros)
  // Recorte del retrato en unidades del viewBox: x, y, ancho, alto.
  recorteRetrato: [96, 2, 108, 108],
  pivote: { x: 0.5, y: 0.97 },        // centro de los pies, normalizado
  margenMin: 4,                       // px transparentes mínimos alrededor del contenido
  tamanosJuego: [48, 84, 180],        // alturas en px en las que se usa en la app
};
