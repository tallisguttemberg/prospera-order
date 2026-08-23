(function (root) {
  'use strict';

  async function dadosDoPeriodo(mesISO) {
    const diarias = await DB.db.diarias.where('data').startsWith(mesISO).sortBy('data');
    const ids = diarias.map((d) => d.id);
    const vendas = await DB.db.vendas.where('diariaId').anyOf(ids).toArray();
    const [clientes, produtos] = await Promise.all([
      DB.db.clientes.toArray(),
      DB.db.produtos.toArray(),
    ]);
    const produtosById = new Map(produtos.map((p) => [p.id, p]));
    const clientesById = new Map(clientes.map((c) => [c.id, c]));
    const vendasPorDiaria = (id) => vendas.filter((v) => v.diariaId === id);
    return {
      diarias,
      resumo: Calc.resumoPeriodo(diarias, vendasPorDiaria, produtosById),
      produtosById,
      clientesById,
      vendas,
    };
  }

  async function csvVendasDoMes(mesISO) {
    const { diarias, vendas, clientesById, produtosById } = await dadosDoPeriodo(mesISO);
    const dataPorDiaria = new Map(diarias.map((d) => [d.id, d.data]));
    const linhas = [['Data', 'Cliente', 'Produto', 'Qtd', 'Valor unit.', 'Total']];
    for (const v of vendas) {
      const p = produtosById.get(v.produtoId) || {};
      linhas.push([
        Util.fmtData(dataPorDiaria.get(v.diariaId) || ''),
        (clientesById.get(v.clienteId) || {}).nome || 'Removido',
        p.nome || 'Removido',
        v.unidades,
        (v.valorUnitCentavos / 100).toFixed(2).replace('.', ','),
        ((v.unidades * v.valorUnitCentavos) / 100).toFixed(2).replace('.', ','),
      ]);
    }
    return linhas.map((l) => l.join(';')).join('\r\n');
  }

  root.Relatorios = { dadosDoPeriodo, csvVendasDoMes };
})(self);
