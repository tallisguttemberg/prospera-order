(function (root) {
  'use strict';

  const CICLO_DIAS = 15;

  const STATUS_INFO = {
    'sem-visita': { rotulo: 'Sem visita', emoji: '⚪', classe: 'sv' },
    atrasada: { rotulo: 'Visita atrasada', emoji: '🔴', classe: 'at' },
    hoje: { rotulo: 'Visita hoje', emoji: '🔵', classe: 'hj' },
    proxima: { rotulo: 'Visita próxima', emoji: '🟠', classe: 'px' },
    'em-dia': { rotulo: 'Em dia', emoji: '🟢', classe: 'ed' },
  };

  const ORDEM_STATUS = ['atrasada', 'hoje', 'proxima', 'em-dia', 'sem-visita'];

  function hojeISO() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function somarDias(iso, dias) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + dias);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  }

  function diasEntre(a, b) {
    const A = new Date(a + 'T00:00:00Z').getTime();
    const B = new Date(b + 'T00:00:00Z').getTime();
    return Math.round((B - A) / 86400000);
  }

  function proximaVisitaDe(ultimaVisita) {
    return ultimaVisita ? somarDias(ultimaVisita, CICLO_DIAS) : null;
  }

  function statusDe(ultimaVisita, hoje) {
    if (!ultimaVisita) {
      return { status: 'sem-visita', diasDesde: null, diasRestantes: null, proximaVisita: null };
    }
    const diasDesde = diasEntre(ultimaVisita, hoje);
    const diasRestantes = CICLO_DIAS - diasDesde;
    let status = 'em-dia';
    if (diasRestantes < 0) status = 'atrasada';
    else if (diasRestantes === 0) status = 'hoje';
    else if (diasRestantes <= 3) status = 'proxima';
    return { status, diasDesde, diasRestantes, proximaVisita: somarDias(ultimaVisita, CICLO_DIAS) };
  }

  function avaliar(cliente, hoje) {
    const s = statusDe(cliente.ultimaVisita, hoje);
    return { cliente, ultimaVisita: cliente.ultimaVisita || null, ...s };
  }

  function avaliarTodos(clientes, hoje) {
    return clientes.filter((c) => c.ativo !== 0).map((c) => avaliar(c, hoje));
  }

  function precisaAtencao(e) {
    return e.status === 'atrasada' || e.status === 'hoje' || e.status === 'sem-visita';
  }

  function agrupar(lista) {
    const m = new Map(ORDEM_STATUS.map((s) => [s, []]));
    for (const e of lista) m.get(e.status).push(e);
    return m;
  }

  function ordenar(lista, tipo) {
    const arr = lista.slice();
    switch (tipo) {
      case 'nome':
        arr.sort((a, b) => String(a.cliente.nome).localeCompare(String(b.cliente.nome), 'pt-BR'));
        break;
      case 'proxima':
        arr.sort((a, b) => {
          const pa = a.proximaVisita || '9999-99-99';
          const pb = b.proximaVisita || '9999-99-99';
          return pa.localeCompare(pb);
        });
        break;
      case 'atraso':
      default:
        arr.sort((a, b) => {
          const ra = a.status === 'sem-visita' ? Number.NEGATIVE_INFINITY : a.diasRestantes;
          const rb = b.status === 'sem-visita' ? Number.NEGATIVE_INFINITY : b.diasRestantes;
          return ra - rb;
        });
        break;
    }
    return arr;
  }

  function hasDb() {
    return typeof root !== 'undefined' && root.DB && root.DB.db;
  }

  async function marcarVisita(clienteId, dataISO, origem) {
    if (!hasDb() || !clienteId || !dataISO) return;
    const db = root.DB.db;
    const dup = await db.visitas
      .where('clienteId')
      .equals(clienteId)
      .and((v) => v.data === dataISO)
      .first();
    if (!dup) {
      await db.visitas.add({ clienteId, data: dataISO, criadoEm: Date.now(), origem: origem || null });
    }
    const c = await db.clientes.get(clienteId);
    if (c) {
      const melhor = c.ultimaVisita && c.ultimaVisita > dataISO ? c.ultimaVisita : dataISO;
      if (melhor !== c.ultimaVisita) await db.clientes.update(clienteId, { ultimaVisita: melhor });
    }
  }

  async function recalcularUltimaVisita(clienteId) {
    if (!hasDb() || !clienteId) return null;
    const db = root.DB.db;
    const [visitas, vendas, diarias] = await Promise.all([
      db.visitas.where('clienteId').equals(clienteId).toArray(),
      db.vendas.where('clienteId').equals(clienteId).toArray(),
      db.diarias.toArray(),
    ]);
    const dataPorDiaria = new Map(diarias.map((d) => [d.id, d.data]));
    let melhor = visitas.reduce((m, v) => (!m || v.data > m ? v.data : m), null);
    for (const v of vendas) {
      const d = dataPorDiaria.get(v.diariaId);
      if (d && (!melhor || d > melhor)) melhor = d;
    }
    await db.clientes.update(clienteId, { ultimaVisita: melhor || null });
    return melhor;
  }

  async function historico(clienteId, limite = 50) {
    if (!hasDb() || !clienteId) return [];
    const lista = await root.DB.db.visitas.where('clienteId').equals(clienteId).toArray();
    return lista
      .sort((a, b) => b.data.localeCompare(a.data) || (b.criadoEm || 0) - (a.criadoEm || 0))
      .slice(0, limite);
  }

  async function clientesPendentes() {
    if (!hasDb()) return [];
    const clientes = await root.DB.db.clientes.toArray();
    return avaliarTodos(clientes, hojeISO()).filter(precisaAtencao);
  }

  async function migrar() {
    if (!hasDb()) return;
    const db = root.DB.db;
    if (await root.DB.getConfig('migracaoUltimaVisita')) return;
    const [clientes, vendas, diarias] = await Promise.all([
      db.clientes.toArray(),
      db.vendas.toArray(),
      db.diarias.toArray(),
    ]);
    const dataPorDiaria = new Map(diarias.map((d) => [d.id, d.data]));
    const porCliente = new Map();
    for (const v of vendas) {
      const d = dataPorDiaria.get(v.diariaId);
      if (!d) continue;
      const atual = porCliente.get(v.clienteId);
      if (!atual || d > atual) porCliente.set(v.clienteId, d);
    }
    const rowsVisitas = await db.visitas.toArray();
    const jaTem = new Set(rowsVisitas.map((x) => x.clienteId + '|' + x.data));
    const novos = [];
    await db.transaction('rw', ['clientes', 'visitas'], async () => {
      for (const c of clientes) {
        const vendaData = porCliente.get(c.id) || null;
        const atual = c.ultimaVisita || null;
        const melhor = vendaData && (!atual || vendaData > atual) ? vendaData : atual;
        if (melhor && melhor !== atual) {
          await db.clientes.update(c.id, { ultimaVisita: melhor });
        }
        if (melhor && !jaTem.has(c.id + '|' + melhor)) {
          novos.push({ clienteId: c.id, data: melhor, criadoEm: Date.now(), origem: 'migracao' });
        }
      }
      if (novos.length) await db.visitas.bulkAdd(novos);
    });
    await root.DB.setConfig('migracaoUltimaVisita', Date.now());
  }

  const api = {
    CICLO_DIAS,
    STATUS_INFO,
    ORDEM_STATUS,
    hojeISO,
    somarDias,
    diasEntre,
    proximaVisitaDe,
    statusDe,
    avaliar,
    avaliarTodos,
    precisaAtencao,
    agrupar,
    ordenar,
    marcarVisita,
    recalcularUltimaVisita,
    historico,
    clientesPendentes,
    migrar,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Acomp = api;
})(typeof self !== 'undefined' ? self : this);