const assert = require('assert');
const A = require('../js/acompanhamento.js');

let passou = 0;
function teste(nome, fn) {
  fn();
  passou++;
  console.log('  ok -', nome);
}

console.log('Testes de acompanhamento (ciclo 15 dias):');

teste('sem visita registrada -> status sem-visita', () => {
  assert.strictEqual(A.statusDe(null, '2026-08-16').status, 'sem-visita');
  assert.strictEqual(A.statusDe('', '2026-08-16').status, 'sem-visita');
});

teste('em dia quando faltam mais de 3 dias', () => {
  const s = A.statusDe('2026-08-01', '2026-08-10');
  assert.strictEqual(s.status, 'em-dia');
  assert.strictEqual(s.diasRestantes, 6);
});

teste('próxima quando faltam entre 1 e 3 dias', () => {
  assert.strictEqual(A.statusDe('2026-08-01', '2026-08-13').status, 'proxima');
  assert.strictEqual(A.statusDe('2026-08-01', '2026-08-14').status, 'proxima');
  assert.strictEqual(A.statusDe('2026-08-01', '2026-08-15').status, 'proxima');
});

teste('visita hoje quando completou exatamente 15 dias', () => {
  const s = A.statusDe('2026-08-01', '2026-08-16');
  assert.strictEqual(s.status, 'hoje');
  assert.strictEqual(s.diasRestantes, 0);
});

teste('atrasada quando passou de 15 dias', () => {
  const s = A.statusDe('2026-08-01', '2026-08-17');
  assert.strictEqual(s.status, 'atrasada');
  assert.strictEqual(s.diasRestantes, -1);
  const s2 = A.statusDe('2026-08-01', '2026-08-20');
  assert.strictEqual(s2.status, 'atrasada');
  assert.strictEqual(s2.diasDesde, 19);
});

teste('próxima visita = última visita + 15 dias', () => {
  assert.strictEqual(A.proximaVisitaDe('2026-08-01'), '2026-08-16');
  assert.strictEqual(A.proximaVisitaDe('2026-08-20'), '2026-09-04');
  assert.strictEqual(A.proximaVisitaDe('2026-12-28'), '2027-01-12');
  assert.strictEqual(A.proximaVisitaDe(null), null);
});

teste('somarDias atravessa mudança de ano', () => {
  assert.strictEqual(A.somarDias('2025-12-28', 15), '2026-01-12');
});

teste('diasEntre calcula diferença em dias', () => {
  assert.strictEqual(A.diasEntre('2026-08-01', '2026-08-16'), 15);
  assert.strictEqual(A.diasEntre('2026-08-16', '2026-08-01'), -15);
});

teste('avaliar retorna ultimaVisita e proximaVisita', () => {
  const e = A.avaliar({ id: 1, nome: 'X', ativo: 1, ultimaVisita: '2026-08-01' }, '2026-08-16');
  assert.strictEqual(e.status, 'hoje');
  assert.strictEqual(e.proximaVisita, '2026-08-16');
  assert.strictEqual(e.ultimaVisita, '2026-08-01');
});

teste('precisaAtencao marca atrasada, hoje e sem-visita', () => {
  assert.ok(A.precisaAtencao({ status: 'atrasada' }));
  assert.ok(A.precisaAtencao({ status: 'hoje' }));
  assert.ok(A.precisaAtencao({ status: 'sem-visita' }));
  assert.ok(!A.precisaAtencao({ status: 'proxima' }));
  assert.ok(!A.precisaAtencao({ status: 'em-dia' }));
});

teste('avaliarTodos ignora clientes inativos', () => {
  const lista = A.avaliarTodos(
    [
      { id: 1, nome: 'A', ativo: 1, ultimaVisita: '2026-08-01' },
      { id: 2, nome: 'B', ativo: 0, ultimaVisita: '2020-01-01' },
    ],
    '2026-08-16'
  );
  assert.strictEqual(lista.length, 1);
  assert.strictEqual(lista[0].cliente.id, 1);
});

teste('ordenar por atraso põe sem-visita e mais atrasados primeiro', () => {
  const base = [
    { cliente: { id: 3, nome: 'C' }, status: 'em-dia', diasRestantes: 6 },
    { cliente: { id: 2, nome: 'B' }, status: 'sem-visita' },
    { cliente: { id: 1, nome: 'A' }, status: 'atrasada', diasRestantes: -3 },
  ];
  const ord = A.ordenar(base, 'atraso');
  assert.strictEqual(ord[0].cliente.id, 2);
  assert.strictEqual(ord[1].cliente.id, 1);
  assert.strictEqual(ord[2].cliente.id, 3);
});

teste('agrupar separa por status preservando ordem', () => {
  const g = A.agrupar([
    { status: 'em-dia' },
    { status: 'atrasada' },
    { status: 'atrasada' },
  ]);
  assert.strictEqual(g.get('atrasada').length, 2);
  assert.strictEqual(g.get('em-dia').length, 1);
  assert.strictEqual(g.get('hoje').length, 0);
  assert.deepStrictEqual([...g.keys()], A.ORDEM_STATUS);
});

console.log(`\n${passou} testes passaram.`);