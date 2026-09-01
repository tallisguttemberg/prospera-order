(function (root) {
  'use strict';

  const db = new Dexie('rotaVendas');

  db.version(1).stores({
    produtos: '++id, nome, ativo',
    clientes: '++id, nome, ativo',
    diarias: '++id, &data, status',
    cargas: '++id, diariaId, produtoId',
    vendas: '++id, diariaId, clienteId, produtoId',
    devolucoes: '++id, diariaId, produtoId',
    snapshots: '++id, criadoEm',
    config: 'chave',
  });

  db.version(2).stores({
    produtos: '++id, nome, ativo',
    clientes: '++id, nome, ativo',
    diarias: '++id, &data, status',
    cargas: '++id, diariaId, produtoId',
    vendas: '++id, diariaId, clienteId, produtoId',
    devolucoes: '++id, diariaId, produtoId',
    snapshots: '++id, criadoEm',
    config: 'chave',
    visitas: '++id, clienteId, data',
  });

  db.version(3).stores({
    produtos: '++id, nome, ativo',
    clientes: '++id, nome, ativo',
    diarias: '++id, &data, status',
    cargas: '++id, diariaId, produtoId',
    vendas: '++id, diariaId, clienteId, produtoId',
    devolucoes: '++id, diariaId, produtoId',
    snapshots: '++id, criadoEm',
    config: 'chave',
    visitas: '++id, clienteId, data',
  });

  db.on('populate', async () => {
    await db.produtos.bulkAdd([
      {
        nome: 'Sorda 400g',
        descricao: 'Pacote de 400 gramas',
        precoCentavos: 700,
        comissaoCentavos: 50,
        unidPorCaixa: 20,
        ativo: 1,
        criadoEm: Date.now(),
      },
      {
        nome: 'Bolo de rolo',
        descricao: 'Unidade',
        precoCentavos: 1200,
        comissaoCentavos: 50,
        unidPorCaixa: 24,
        ativo: 1,
        criadoEm: Date.now(),
      },
    ]);
    await db.config.put({ chave: 'vendedorNome', valor: '' });
    await db.config.put({ chave: 'empresaNome', valor: '' });
    await db.config.put({ chave: 'empresaContato', valor: '' });
    await db.config.put({ chave: 'vendedorWhatsapp', valor: '' });
    await db.config.put({ chave: 'senhaExclusao', valor: '' });
    await db.config.put({ chave: 'ultimoBackupArquivo', valor: null });
  });

  async function getConfig(chave) {
    const r = await db.config.get(chave);
    return r ? r.valor : undefined;
  }

  async function setConfig(chave, valor) {
    await db.config.put({ chave, valor });
  }

  async function diariaAberta() {
    return (await db.diarias.where('status').equals('aberta').first()) || null;
  }

  async function dadosDiaria(id) {
    const [cargas, vendas, devolucoes] = await Promise.all([
      db.cargas.where('diariaId').equals(id).toArray(),
      db.vendas.where('diariaId').equals(id).toArray(),
      db.devolucoes.where('diariaId').equals(id).toArray(),
    ]);
    return { cargas, vendas, devolucoes };
  }

  async function produtosAtivos() {
    return db.produtos.where('ativo').equals(1).sortBy('nome');
  }

  root.DB = {
    db,
    getConfig,
    setConfig,
    diariaAberta,
    dadosDiaria,
    produtosAtivos,
  };
})(self);
