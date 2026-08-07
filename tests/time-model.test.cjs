const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const indexPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const babelBlock = [...html.matchAll(/<script type="text\/babel">([\s\S]*?)<\/script>/g)];

assert.equal(babelBlock.length, 1, 'index.html deve conter um único bloco Babel');

const source = babelBlock[0][1];
const pureStart = source.indexOf('const UPTAKE=60;');
const pureEnd = source.indexOf('function Fld');

assert.ok(pureStart >= 0 && pureEnd > pureStart, 'funções puras do motor não encontradas');

const context = { assert, console, navigator: {} };
const checks = `
  const planned={hSim:"08:15",hInjReal:"",doseReal:""};
  assert.equal(horaInjecaoEfetiva(planned),"08:15");
  assert.equal(horaEntradaSala(planned,60),"09:15");
  assert.equal(horaTerminoExame(planned,60,25),"09:40");

  const injected={hSim:"08:15",hInjReal:"08:28",doseReal:"8.0"};
  assert.equal(horaInjecaoEfetiva(injected),"08:28");
  assert.equal(horaEntradaSala(injected,60),"09:28");
  assert.equal(horaTerminoExame(injected,60,25),"09:53");

  const legacy={hSim:"08:15",doseReal:"8.0"};
  assert.equal(horaInjecaoEfetiva(legacy),"08:15");
  assert.equal(horaValida("08:59"),true);
  assert.equal(horaValida("08:60"),false);
  assert.equal(horaValida("24:00"),false);

  const recalculated=recalc([injected],100,10,"08:00",109.77,4,0.08,0.12).lista[0];
  assert.equal(recalculated.dt,28);

  const cleared=atualizacaoDoseReal(injected,"");
  assert.equal(cleared.hInjReal,"");
  assert.equal(cleared.doseReferencia,"");

  let seed=0x12345678;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/0x100000000;};
  for(let i=0;i<10000;i++){
    const h=Math.floor(random()*24),m=Math.floor(random()*60);
    const uptake=1+Math.floor(random()*120),duration=1+Math.floor(random()*60);
    const plannedTime=minsToTime(h*60+m),actualTime=minsToTime(h*60+m+Math.floor(random()*91));
    const registered=i%2===0;
    const patient={hSim:plannedTime,hInjReal:registered?actualTime:"",doseReal:registered?"5":""};
    const base=registered?actualTime:plannedTime;
    assert.equal(horaEntradaSala(patient,uptake),addMin(base,uptake));
    assert.equal(horaTerminoExame(patient,uptake,duration),addMin(base,uptake+duration));
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

console.log('Modelo temporal: 10.000 cenários e traduções validados.');
