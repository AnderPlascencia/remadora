// Datos fijos del sistema de personajes: clases, rangos, paletas y formato de exportación.
// Fuente única para el generador, los scripts de validación y el manifiesto.

export const VERSION_MAESTRO = '1.0.0';

export const RANGOS = [
  { id: 'principiante', nombre: 'Principiante', edad: '18–22', nivel: 1 },
  { id: 'combatiente', nombre: 'Combatiente', edad: '23–28', nivel: 10 },
  { id: 'veterano', nombre: 'Veterano', edad: '30–38', nivel: 20 },
  { id: 'elite', nombre: 'Élite', edad: '39–48', nivel: 35 },
  { id: 'legendario', nombre: 'Legendario', edad: '50–65', nivel: 50 },
];

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
  recorteRetrato: [60, 4, 180, 180],
  pivote: { x: 0.5, y: 0.97 },        // centro de los pies, normalizado
  margenMin: 4,                       // px transparentes mínimos alrededor del contenido
  tamanosJuego: [48, 84, 180],        // alturas en px en las que se usa en la app
};
