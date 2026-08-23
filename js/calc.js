(function (root) {
  'use strict';

  function totaisProduto(cargas, vendas, devolucoes, produtoId) {
    const pego = cargas
      .filter((c) => c.produtoId === produtoId)
      .reduce((s, c) => s + c.unidades, 0);
    const vendido = vendas
      .filter((v) => v.produtoId === produtoId)
      .reduce((s, v) => s + v.unidades, 0);
    const devolvido = devolucoes
      .filter((d) => d.produtoId === produtoId)
      .reduce((s, d) => s + d.unidades, 0);
    return { pego, vendido, devolvido, restante: pego - vendido - devolvido };
  }

  function resumoDiaria(cargas, vendas, devolucoes, produtos) {
    const porProduto = produtos.map((p) => {
      const t = totaisProduto(cargas, vendas, devolucoes, p.id);
      return { produtoId: p.id, nome: p.nome, ...t };
    });
    const arrecadadoCentavos = vendas.reduce(
      (s, v) => s + v.unidades * v.valorUnitCentavos,
      0
    );
    const ganhoCentavos = vendas.reduce(
      (s, v) => s + v.unidades * v.comissaoUnitCentavos,
      0
    );
    const pagarFornecedorCentavos = arrecadadoCentavos - ganhoCentavos;
    return {
      porProduto,
      arrecadadoCentavos,
      ganhoCentavos,
      pagarFornecedorCentavos,
    };
  }

  function validarDevolucao(restante, quantidade) {
    const q = Math.floor(Number(quantidade));
    if (!Number.isFinite(q) || q < 0) return { ok: false, motivo: 'Quantidade inválida.' };
    if (q > restante) {
      return {
        ok: false,
        motivo: `Devolução maior que o restante na sacola (disponível: ${restante}).`,
      };
    }
    return { ok: true, qtd: q };
  }

  function validarCarga(unidPorCaixa, caixas, avulsas) {
    const c = Math.floor(Number(caixas) || 0);
    const a = Math.floor(Number(avulsas) || 0);
    if (c < 0 || a < 0) return { ok: false, motivo: 'Valores negativos não são permitidos.' };
    if (c === 0 && a === 0) return { ok: false, motivo: 'Informe ao menos uma caixa ou unidade.' };
    if (!Number.isFinite(Number(unidPorCaixa)) || unidPorCaixa <= 0) {
      return { ok: false, motivo: 'Produto sem unidades por caixa definidas.' };
    }
    return { ok: true, unidades: c * unidPorCaixa + a };
  }

  function resumoPeriodo(diariasDoPeriodo, vendasPorDiaria, produtosById) {
    let faturamentoCentavos = 0;
    let ganhoCentavos = 0;
    const porProdutoMap = new Map();
    const porClienteMap = new Map();
    for (const d of diariasDoPeriodo) {
      const vendas = vendasPorDiaria(d.id);
      for (const v of vendas) {
        const total = v.unidades * v.valorUnitCentavos;
        const comissao = v.unidades * v.comissaoUnitCentavos;
        faturamentoCentavos += total;
        ganhoCentavos += comissao;
        const pp = porProdutoMap.get(v.produtoId) || {
          nome: (produtosById.get(v.produtoId) || {}).nome || 'Removido',
          unidades: 0,
          totalCentavos: 0,
        };
        pp.unidades += v.unidades;
        pp.totalCentavos += total;
        porProdutoMap.set(v.produtoId, pp);
        const pc = porClienteMap.get(v.clienteId) || {
          nome: '',
          unidades: 0,
          totalCentavos: 0,
        };
        pc.unidades += v.unidades;
        pc.totalCentavos += total;
        porClienteMap.set(v.clienteId, pc);
      }
    }
    const porProduto = [...porProdutoMap.entries()]
      .map(([produtoId, x]) => ({ produtoId, ...x }))
      .sort((a, b) => b.totalCentavos - a.totalCentavos);
    return {
      faturamentoCentavos,
      ganhoCentavos,
      diasComVenda: new Set(
        diariasDoPeriodo.filter((d) => vendasPorDiaria(d.id).length > 0).map((d) => d.data)
      ).size,
      porProduto,
      porCliente: [...porClienteMap.entries()]
        .map(([clienteId, x]) => ({ clienteId, ...x }))
        .sort((a, b) => b.totalCentavos - a.totalCentavos),
    };
  }

  const api = {
    totaisProduto,
    resumoDiaria,
    validarDevolucao,
    validarCarga,
    resumoPeriodo,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof self !== 'undefined' ? self : this);
