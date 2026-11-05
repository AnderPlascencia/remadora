// Frases de clase grabadas con la voz propia de cada personaje (ElevenLabs; fichas en docs/voces-clase.md).
// Si una frase está aquí, voz.js reproduce el MP3 en vez de la voz del navegador. Los datos (watts, ritmo, tiempo)
// siguen con la voz del navegador. El texto debe ser idéntico al de FRASES_CLASE (src/voz-juego.js).
const dir = (clase) => `assets/voces/${clase}/`;

export const GRABADAS = {
  vikingo: {
    'Cada palada, un hachazo': 'frase-1.mp3',
    'Rema como quien abre el mar': 'frase-2.mp3',
    'Los cuervos te miran: no aflojes': 'frase-3.mp3',
    'Fuerza en las piernas, guerrero': 'frase-4.mp3',
    'El Valhalla se gana palada a palada': 'frase-5.mp3',
    'Respira, guerrero; el mar espera': 'frase-6.mp3',
  },
  romano: {
    'Un romano no se rinde. Nunca': 'frase-1.mp3',
    'Paso de legión: firme y constante': 'frase-2.mp3',
    'Roma no se hizo en un día': 'frase-3.mp3',
    'Disciplina hoy, gloria mañana': 'frase-4.mp3',
    'Marca el ritmo, legionario': 'frase-5.mp3',
  },
};

const PORTEXTO = new Map(Object.entries(GRABADAS)
  .flatMap(([clase, frases]) => Object.entries(frases).map(([t, f]) => [t, dir(clase) + f])));

// Ruta del MP3 de una frase, o null si no está grabada.
export const grabacionDe = (texto) => PORTEXTO.get(texto) ?? null;
// Todas las rutas (para guardarlas sin conexión).
export const RUTAS_GRABADAS = [...PORTEXTO.values()];
