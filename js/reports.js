(function (root) {
  'use strict';

  async function dadosDoPeriodo(mesISO) {
    const diarias = await DB.db.diarias.where('data').startsWith(mesISO).sortBy('data');
    const ids = diarias.map((d) => d.id);
    const vendas = await DB.db.vendas.where('diariaId').anyOf(ids).toArray();
    const [clientes, produtos, categorias] = await Promise.all([
      DB.db.clientes.toArray(),
      DB.db.produtos.toArray(),
      DB.db.categoriasSaida.toArray(),
    ]);
    const produtosById = new Map(produtos.map((p) => [p.id, p]));
    const clientesById = new Map(clientes.map((c) => [c.id, c]));
    const categoriasById = new Map(categorias.map((c) => [c.id, c]));
    const vendasPorDiaria = (id) => vendas.filter((v) => v.diariaId === id);
    let saidas = null;
    if (categorias.length) {
      saidas = Calc.resumoSaidasPeriodo(diarias, vendasPorDiaria, produtosById, categoriasById);
    }
    return {
      diarias,
      resumo: Calc.resumoPeriodo(diarias, vendasPorDiaria, produtosById),
      saidas,
      produtosById,
      clientesById,
      categoriasById,
      vendas,
    };
  }

  async function csvVendasDoMes(mesISO) {
    const { diarias, vendas, clientesById, produtosById } = await dadosDoPeriodo(mesISO);
    const dataPorDiaria = new Map(diarias.map((d) => [d.id, d.data]));
    const linhas = [['Data', 'Cliente', 'Produto', 'Qtd', 'Valor unit.', 'Total']];
    for (const v of vendas) {
      if (v.tipoSaida) continue;
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

  async function csvSaidasDoMes(mesISO) {
    const { diarias, vendas, clientesById, produtosById, categoriasById } = await dadosDoPeriodo(mesISO);
    const dataPorDiaria = new Map(diarias.map((d) => [d.id, d.data]));
    const linhas = [['Data', 'Cliente', 'Produto', 'Categoria', 'Qtd', 'Valor', 'Total']];
    for (const v of vendas) {
      if (!v.tipoSaida) continue;
      const p = produtosById.get(v.produtoId) || {};
      const cat = categoriasById.get(v.tipoSaida) || {};
      linhas.push([
        Util.fmtData(dataPorDiaria.get(v.diariaId) || ''),
        (clientesById.get(v.clienteId) || {}).nome || 'Removido',
        p.nome || 'Removido',
        cat.nome || 'Saída',
        v.unidades,
        (v.valorUnitCentavos / 100).toFixed(2).replace('.', ','),
        ((v.unidades * v.valorUnitCentavos) / 100).toFixed(2).replace('.', ','),
      ]);
    }
    return linhas.map((l) => l.join(';')).join('\r\n');
  }

  root.Relatorios = { dadosDoPeriodo, csvVendasDoMes, csvSaidasDoMes };
})(self);
