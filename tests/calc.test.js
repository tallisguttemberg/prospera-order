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

teste('resumoPeriodo ignora vendas com tipoSaida no faturamento/ganho', () => {
  const diarias = [{ id: 10, data: '2026-08-01' }];
  const vendas = {
    10: [
      { clienteId: 1, produtoId: 1, unidades: 10, valorUnitCentavos: 700, comissaoUnitCentavos: 50 },
      { clienteId: 2, produtoId: 1, unidades: 5, valorUnitCentavos: 700, comissaoUnitCentavos: 0, tipoSaida: 1 },
    ],
  };
  const r = Calc.resumoPeriodo(diarias, (id) => vendas[id], new Map([[1, { nome: 'Sorda' }]]));
  assert.strictEqual(r.faturamentoCentavos, 7000);
  assert.strictEqual(r.ganhoCentavos, 500);
  assert.strictEqual(r.diasComVenda, 1);
  assert.strictEqual(r.porProduto[0].unidades, 10);
});

teste('exibirQtd mostra caixa/kit quando emCaixa=true e unidade quando false', () => {
  const p = { unidPorCaixa: 20 };
  assert.deepStrictEqual(Calc.exibirQtd(43, p, true),
    { rotulo: '2 caixas + 3 un', caixas: 2, avulsas: 3 });
  assert.deepStrictEqual(Calc.exibirQtd(20, p, true),
    { rotulo: '1 caixa', caixas: 1, avulsas: 0 });
  assert.deepStrictEqual(Calc.exibirQtd(13, p, false),
    { rotulo: '13 un', caixas: 0, avulsas: 13 });
  assert.deepStrictEqual(Calc.exibirQtd(13, p, undefined),
    { rotulo: '13 un', caixas: 0, avulsas: 13 });
});

teste('precoCaixaCentavos calcula unitario x qtd na caixa', () => {
  assert.strictEqual(Calc.precoCaixaCentavos({ precoCentavos: 700, unidPorCaixa: 20 }), 14000);
  assert.strictEqual(Calc.precoCaixaCentavos({ precoCentavos: 1200, unidPorCaixa: 24 }), 28800);
  assert.strictEqual(Calc.precoCaixaCentavos({ precoCentavos: 500, unidPorCaixa: 1 }), null);
});

teste('resumoSaidasPeriodo agrega por categoria, cliente e produto', () => {
  const diarias = [{ id: 10, data: '2026-08-01' }];
  const vendas = {
    10: [
      { clienteId: 1, produtoId: 1, unidades: 5, valorUnitCentavos: 700, comissaoUnitCentavos: 0, tipoSaida: 101 },
      { clienteId: 2, produtoId: 2, unidades: 2, valorUnitCentavos: 1200, comissaoUnitCentavos: 0, tipoSaida: 102 },
      { clienteId: 1, produtoId: 1, unidades: 3, valorUnitCentavos: 700, comissaoUnitCentavos: 0, tipoSaida: 101 },
    ],
  };
  const categ = new Map([[101, { nome: 'Defeito' }], [102, { nome: 'Demo' }]]);
  const r = Calc.resumoSaidasPeriodo(diarias, (id) => vendas[id], new Map([[1, { nome: 'Sorda' }], [2, { nome: 'Bolo' }]]), categ);
  assert.strictEqual(r.totalUnidades, 10);
  assert.strictEqual(r.totalCentavos, (5 * 700) + (2 * 1200) + (3 * 700));
  const def = r.porCategoria.find((c) => c.nome === 'Defeito');
  assert.strictEqual(def.unidades, 8);
  assert.strictEqual(def.totalCentavos, 8 * 700);
  const cli1 = r.porCliente.find((c) => c.clienteId === 1);
  assert.strictEqual(cli1.unidades, 8);
});

console.log(`\n${passou} testes passaram.`);
