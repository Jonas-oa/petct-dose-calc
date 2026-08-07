const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const indexPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const babelBlock = [...html.matchAll(/<script type="text\/babel">([\s\S]*?)<\/script>/g)];

assert.equal(babelBlock.length, 1, 'index.html deve conter um único bloco Babel');

const source = babelBlock[0][1];
const pureStart = source.indexOf('const SALA_OFFSET_MIN=60;');
const pureEnd = source.indexOf('function Fld');

assert.ok(pureStart >= 0 && pureEnd > pureStart, 'funções puras do motor não encontradas');

const context = { assert, console, navigator: {} };
const checks = `
  assert.equal(horaEntradaSala({hSim:"08:00"}),"09:00");
  assert.equal(horaEntradaSala({hSim:"08:15"}),"09:15");
  assert.equal(horaEntradaSala({hSim:"23:30"}),"00:30");

  assert.equal(horaValida("08:59"),true);
  assert.equal(horaValida("08:60"),false);
  assert.equal(horaValida("24:00"),false);

  const antigo={id:1,hSim:"08:15",hInjReal:"08:28",doseReal:"8.0"};
  const migrado=migrarPacienteHorario(antigo);
  assert.equal(migrado.hSim,"08:28");
  assert.equal(Object.prototype.hasOwnProperty.call(migrado,"hInjReal"),false);

  const semHoraReal=migrarPacienteHorario({id:2,hSim:"09:10",hInjReal:""});
  assert.equal(semHoraReal.hSim,"09:10");
  assert.equal(Object.prototype.hasOwnProperty.call(semHoraReal,"hInjReal"),false);

  const horaRealInvalida=migrarPacienteHorario({id:3,hSim:"10:20",hInjReal:"25:00"});
  assert.equal(horaRealInvalida.hSim,"10:20");

  const cfgMigrada=migrarConfiguracao({intervalo:30,uptake:45,duracaoExame:20,instituicao:"Teste"});
  assert.equal(cfgMigrada.intervalo,30);
  assert.equal(cfgMigrada.instituicao,"Teste");
  assert.equal(Object.prototype.hasOwnProperty.call(cfgMigrada,"uptake"),false);
  assert.equal(Object.prototype.hasOwnProperty.call(cfgMigrada,"duracaoExame"),false);

  const recalculado=recalc([migrado],100,10,"08:00",109.77,4,0.08,0.12).lista[0];
  assert.equal(recalculado.dt,28);

  const doseAtualizada=atualizacaoDoseReal({...migrado,dPmax:10,doseAplicar:8},"7.5");
  assert.equal(doseAtualizada.doseReal,"7.5");
  assert.equal(Object.prototype.hasOwnProperty.call(doseAtualizada,"hInjReal"),false);

  let seed=0x12345678;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/0x100000000;};
  for(let i=0;i<10000;i++){
    const h=Math.floor(random()*24),m=Math.floor(random()*60);
    const injecao=minsToTime(h*60+m);
    assert.equal(horaEntradaSala({hSim:injecao}),addMin(injecao,60));
  }
`;

vm.runInNewContext(source.slice(pureStart, pureEnd) + checks, context);

const dictStart = source.indexOf('const LANGS_DICT=');
const dictEnd = source.indexOf('function App()', dictStart);
const languageContext = {};
vm.runInNewContext(source.slice(dictStart, dictEnd) + '\nthis.dict=LANGS_DICT;', languageContext);

const referenceKeys = Object.keys(languageContext.dict.pt).sort();
for (const language of ['en', 'es']) {
  assert.deepEqual(Object.keys(languageContext.dict[language]).sort(), referenceKeys);
}

const usedKeys = [...source.matchAll(/lang\.([A-Za-z0-9_]+)/g)].map(match => match[1]);
const missingKeys = [...new Set(usedKeys)].filter(key => !(key in languageContext.dict.pt));
assert.deepEqual(missingKeys, []);

console.log('Modelo temporal simplificado: sala fixa em +60 min, migração e traduções validadas.');
