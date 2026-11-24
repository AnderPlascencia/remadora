// Lista las pruebas e2e que fallaron y pasaron al reintentar (estado «flaky» del informe JSON de Playwright).
// El reintento las deja en verde en el PR; aquí salen en el resumen del trabajo para arreglarlas, no esconderlas.
import { readFileSync, appendFileSync } from 'node:fs';

const ruta = process.argv[2] || 'e2e-resultados.json';
let informe;
try { informe = JSON.parse(readFileSync(ruta, 'utf8')); } catch { console.log(`Sin informe en ${ruta}`); process.exit(0); }

const inestables = [];
const recorrer = (suite, camino = []) => {
  const aqui = suite.title ? [...camino, suite.title] : camino;
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      if (t.status === 'flaky') inestables.push(`${[...aqui, spec.title].join(' › ')} (${t.projectName})`);
    }
  }
  for (const s of suite.suites || []) recorrer(s, aqui);
};
for (const s of informe.suites || []) recorrer(s);

const texto = inestables.length
  ? `### Pruebas e2e inestables (pasaron solo al reintentar)\n\n${inestables.map((x) => `- ${x}`).join('\n')}\n`
  : '### Pruebas e2e inestables\n\nNinguna: todas pasaron a la primera.\n';
console.log(texto);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texto}\n`);
