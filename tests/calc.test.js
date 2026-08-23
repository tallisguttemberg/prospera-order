const assert = require('assert');
const Calc = require('../js/calc.js');

let passou = 0;
function teste(nome, fn) {
  fn();
  passou++;
  console.log('  ok -', nome);
}

console.log('Testes de cálculo:');

teste('totaisProduto soma cargas/vendas/devoluções', () => {
  const t = Calc.totaisProduto(
    [{ produtoId: 1, unidades: 40 }, { produtoId: 1, unidades: 5 }, { produtoId: 2, unidades: 24 }],
    [{ produtoId: 1, unidades: 30 }],
    [{ produtoId: 1, unidades: 7 }],
    1
  );
  assert.deepStrictEqual(t, { pego: 45, vendido: 30, devolvido: 7, restante: 8 });
});

teste('resumoDiaria calcula dinheiro conforme exemplo do usuário', () => {
  const produtos = [
    { id: 1, nome: 'Sorda 400g' },
    { id: 2, nome: 'Bolo de rolo' },
  ];
  const r = Calc.resumoDiaria(
    [{ produtoId: 1, unidades: 20 }],
    [
      { produtoId: 1, unidades: 10, valorUnitCentavos: 700, comissaoUnitCentavos: 50 },
      { produtoId: 2, unidades: 4, valorUnitCentavos: 1200, comissaoUnitCentavos: 50 },
    ],
    [{ produtoId: 1, unidades: 6 }],
    produtos
  );
  assert.strictEqual(r.arrecadadoCentavos, 7000 + 4800);
  assert.strictEqual(r.ganhoCentavos, 500 + 200);
  assert.strictEqual(r.pagarFornecedorCentavos, (7000 + 4800) - (500 + 200));
  const sorda = r.porProduto.find((p) => p.nome === 'Sorda 400g');
  assert.strictEqual(sorda.restante, 20 - 10 - 6);
});

teste('validarDevolucao rejeita acima do restante e negativos', () => {
  assert.ok(Calc.validarDevolucao(8, 8).ok);
  assert.ok(!Calc.validarDevolucao(8, 9).ok);
  assert.ok(!Calc.validarDevolucao(8, -1).ok);
  assert.ok(!Calc.validarDevolucao(8, 'abc').ok);
});

teste('validarCarga converte caixas+avulsas em unidades', () => {
  assert.strictEqual(Calc.validarCarga(20, 2, 3).unidades, 43);
  assert.ok(!Calc.validarCarga(20, 0, 0).ok);
  assert.ok(!Calc.validarCarga(20, -1, 0).ok);
  assert.strictEqual(Calc.validarCarga(24, 1, 0).unidades, 24);
});

teste('resumoPeriodo agrega faturamento, ganho, ranking de clientes/produtos', () => {
  const diarias = [{ id: 10, data: '2026-08-01' }, { id: 11, data: '2026-08-02' }];
  const vendas = {
    10: [
      { clienteId: 1, produtoId: 1, unidades: 10, valorUnitCentavos: 700, comissaoUnitCentavos: 50 },
      { clienteId: 2, produtoId: 2, unidades: 2, valorUnitCentavos: 1200, comissaoUnitCentavos: 50 },
    ],
    11: [{ clienteId: 1, produtoId: 1, unidades: 5, valorUnitCentavos: 700, comissaoUnitCentavos: 50 }],
  };
  const r = Calc.resumoPeriodo(diarias, (id) => vendas[id], new Map([[1, { nome: 'Sorda' }]]));
  assert.strictEqual(r.faturamentoCentavos, 7000 + 2400 + 3500);
  assert.strictEqual(r.ganhoCentavos, 500 + 100 + 250);
  assert.strictEqual(r.diasComVenda, 2);
  assert.strictEqual(r.porProduto[0].nome, 'Sorda');
  assert.strictEqual(r.porCliente[0].clienteId, 1);
});

console.log(`\n${passou} testes passaram.`);
