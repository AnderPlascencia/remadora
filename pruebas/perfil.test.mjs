import assert from 'node:assert/strict';
import * as Pf from '../src/perfil.js';
import * as P from '../src/programa.js';
import * as G from '../src/guia.js';
import { clasificacionDe } from '../src/juego.js';

// Basal: Mifflin-St Jeor con todos los datos; si falta alguno, 1 kcal por kg y hora (lo de antes).
assert.equal(Pf.basalPorHora({ peso: 80 }), 80);
assert.equal(Math.round(Pf.basalPorHora({ peso: 80, edad: 40, altura: 180, sexo: 'h' }) * 24), 1730);
assert.equal(Math.round(Pf.basalPorHora({ peso: 60, edad: 30, altura: 165, sexo: 'm' }) * 24), 1320);
assert.equal(Pf.basalPorHora({ peso: 60, edad: 30, altura: 165, sexo: 'x' }), 60, 'sin sexo no inventa');

// FTP inicial: sube con la experiencia, baja con la edad y es menor para mujeres; sin peso no hay.
assert.equal(Pf.ftpInicial({}), 0);
const h = Pf.ftpInicial({ peso: 80, sexo: 'h', edad: 30, experiencia: 'medio' });
assert.equal(h, 145);
assert.ok(Pf.ftpInicial({ peso: 80, sexo: 'h', edad: 30, experiencia: 'alto' }) > h);
assert.ok(Pf.ftpInicial({ peso: 80, sexo: 'h', edad: 60, experiencia: 'medio' }) < h);
assert.ok(Pf.ftpInicial({ peso: 80, sexo: 'm', edad: 30, experiencia: 'medio' }) < h);

// Completitud y lo que el perfil aporta al plan.
assert.equal(Pf.completitud({}).hechos, 0);
assert.equal(Pf.completitud({ edad: 35, sexo: 'h', peso: 80, altura: 180, experiencia: 'medio', minutos: 0 }).faltan.length, 0);
assert.deepEqual(Pf.ctxPlanDePerfil({ experiencia: 'alto', minutos: 45 }), { nivel: 'alto', minutosMax: 45 });
assert.deepEqual(Pf.ctxPlanDePerfil({ experiencia: 'alto', minutos: 0 }, { sinHistorial: false }), {}, 'con historial manda el historial');

// Tripulación: con factor para mujeres, los mismos W/kg dan un puesto igual o más alto.
assert.equal(clasificacionDe(160, 80).nombre, 'Contramaestre');
assert.equal(clasificacionDe(170, 80).nombre, 'Contramaestre');
assert.equal(clasificacionDe(170, 80, Pf.factorClasificacion('m')).nombre, 'Primer oficial');
assert.equal(clasificacionDe(160, 80, 1).faltaW, 40);

// Tope de minutos: ninguna sesión (salvo las pruebas, que miden siempre lo mismo) pasa del tiempo elegido.
for (const o of P.OBJETIVOS_PLAN) {
  for (const minutosMax of [30, 45, 60]) {
    for (const nivel of ['inicio', 'medio', 'alto']) {
      const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: o.clave, nivel, dias: 5, semanas: 8, inicio: '2026-11-02', ctx: { minutosMax } });
      assert.equal(programa.dias.length, 40);
      assert.equal(programa.minutosMax, minutosMax);
      const largas = entrenamientos.filter((e) => e.enfoque !== 'pruebas' && P.duracionPlan(e) > minutosMax * 60);
      assert.deepEqual(largas.map((e) => e.nombre), [], `${o.clave} ${nivel} ${minutosMax} min`);
    }
  }
}
// Sin tope, el plan es el mismo de siempre.
const sin = P.planPorObjetivo({ objetivo: 'umbral', dias: 3, semanas: 8, inicio: '2026-11-02', ctx: {} });
const cero = P.planPorObjetivo({ objetivo: 'umbral', dias: 3, semanas: 8, inicio: '2026-11-02', ctx: { minutosMax: 0 } });
assert.deepEqual(cero.programa.dias, sin.programa.dias);
assert.equal(sin.programa.minutosMax, undefined);

// Guía: cada tema lleva a una pestaña que existe y cada pestaña tiene su consejo.
const VISTAS = ['entrenar', 'entrenamientos', 'heroe', 'historial', 'ajustes'];
assert.ok(G.TEMAS.every((t) => VISTAS.includes(t.vista) && t.puntos.length >= 3 && t.resumen));
assert.ok(VISTAS.every((v) => G.consejoDe(v)));
console.log('perfil ok');
// Escalera de la tripulación: 5 puestos, el tuyo marcado y el avance hacia el siguiente.
import { escalaTripulacion } from '../src/juego.js';
const esc = escalaTripulacion(145, 82);
assert.equal(esc.filas.length, 5);
assert.deepEqual(esc.filas.map((f) => f.estado), ['pasado', 'actual', 'siguiente', 'futuro', 'futuro']);
assert.equal(esc.filas[2].w, 164);
assert.ok(esc.progreso > 0.5 && esc.progreso < 0.6);
assert.equal(escalaTripulacion(300, 80).progreso, 1, 'Capitán: tramo lleno');
assert.equal(escalaTripulacion(170, 80, 0.82).filas[3].estado, 'actual');
console.log('tripulación ok');
