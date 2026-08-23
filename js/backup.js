(function (root) {
  'use strict';

  const INTERVALO_SNAPSHOT = 2 * 60 * 60 * 1000;
  const LEMBRETE_ARQUIVO_MS = 3 * 24 * 60 * 60 * 1000;
  const MAX_SNAPSHOTS = 20;

  async function dumpAll() {
    const [produtos, clientes, diarias, cargas, vendas, devolucoes, config] =
      await Promise.all([
        DB.db.produtos.toArray(),
        DB.db.clientes.toArray(),
        DB.db.diarias.toArray(),
        DB.db.cargas.toArray(),
        DB.db.vendas.toArray(),
        DB.db.devolucoes.toArray(),
        DB.db.config.toArray(),
      ]);
    return {
      app: 'prospera-order',
      versao: 1,
      geradoEm: Date.now(),
      dados: { produtos, clientes, diarias, cargas, vendas, devolucoes, config },
    };
  }

  async function substituirTudo(dump) {
    const d = dump.dados;
    await DB.db.transaction(
      'rw',
      ['produtos', 'clientes', 'diarias', 'cargas', 'vendas', 'devolucoes', 'config'],
      async () => {
        await Promise.all([
          DB.db.produtos.clear(),
          DB.db.clientes.clear(),
          DB.db.diarias.clear(),
          DB.db.cargas.clear(),
          DB.db.vendas.clear(),
          DB.db.devolucoes.clear(),
          DB.db.config.clear(),
        ]);
        await DB.db.produtos.bulkAdd(d.produtos || []);
        await DB.db.clientes.bulkAdd(d.clientes || []);
        await DB.db.diarias.bulkAdd(d.diarias || []);
        await DB.db.cargas.bulkAdd(d.cargas || []);
        await DB.db.vendas.bulkAdd(d.vendas || []);
        await DB.db.devolucoes.bulkAdd(d.devolucoes || []);
        await DB.db.config.bulkPut(d.config || []);
      }
    );
  }

  function baixarArquivo(conteudo, nome, tipo) {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function exportarArquivo() {
    const dump = await dumpAll();
    const agora = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const nome = `prospera-order-backup-${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}.json`;
    baixarArquivo(JSON.stringify(dump, null, 2), nome, 'application/json');
    await DB.setConfig('ultimoBackupArquivo', Date.now());
  }

  function validarDump(dump) {
    return (
      dump &&
      typeof dump.app === 'string' &&
      ['prospera-order', 'rota-vendas'].includes(dump.app) &&
      typeof dump.dados === 'object' &&
      Array.isArray(dump.dados.produtos)
    );
  }

  async function importarArquivo(file) {
    let dump;
    try {
      dump = JSON.parse(await file.text());
    } catch {
      Util.toast('Arquivo inválido.', 'erro');
      return false;
    }
    if (!validarDump(dump)) {
      Util.toast('Este arquivo não é um backup do Prospera Order.', 'erro');
      return false;
    }
    const ok = await Util.confirmar(
      'Restaurar backup',
      `Isso vai <b>substituir todos os dados atuais</b> pelo backup gerado em ${Util.fmtDataHora(dump.geradoEm)}. Continuar?`,
      'Restaurar'
    );
    if (!ok) return false;
    await substituirTudo(dump);
    await DB.setConfig('ultimoBackupArquivo', dump.geradoEm);
    location.reload();
    return true;
  }

  async function criarSnapshot(origem) {
    const dump = await dumpAll();
    const json = JSON.stringify(dump);
    await DB.db.snapshots.add({
      criadoEm: Date.now(),
      origem: origem || 'manual',
      bytes: json.length,
      dados: json,
    });
    const todos = await DB.db.snapshots.orderBy('criadoEm').toArray();
    if (todos.length > MAX_SNAPSHOTS) {
      const excluir = todos.slice(0, todos.length - MAX_SNAPSHOTS).map((s) => s.id);
      await DB.db.snapshots.bulkDelete(excluir);
    }
  }

  async function restaurarSnapshot(id) {
    const s = await DB.db.snapshots.get(id);
    if (!s) return;
    const ok = await Util.confirmar(
      'Restaurar versão',
      `Voltar tudo para o estado salvo em <b>${Util.fmtDataHora(s.criadoEm)}</b>?`,
      'Restaurar'
    );
    if (!ok) return;
    await substituirTudo(JSON.parse(s.dados));
    location.reload();
  }

  async function excluirSnapshot(id) {
    await DB.db.snapshots.delete(id);
  }

  async function ultimoSnapshot() {
    const s = await DB.db.snapshots.orderBy('criadoEm').last();
    return s || null;
  }

  async function iniciarAuto() {
    const ultimo = await ultimoSnapshot();
    if (!ultimo || Date.now() - ultimo.criadoEm >= INTERVALO_SNAPSHOT) {
      await criarSnapshot('auto');
    }
    setInterval(async () => {
      const u = await ultimoSnapshot();
      if (u && Date.now() - u.criadoEm >= INTERVALO_SNAPSHOT) {
        await criarSnapshot('auto');
      }
    }, 5 * 60 * 1000);
  }

  async function lembretePendente() {
    const ult = await DB.getConfig('ultimoBackupArquivo');
    return !ult || Date.now() - ult > LEMBRETE_ARQUIVO_MS;
  }

  root.Backup = {
    exportarArquivo,
    importarArquivo,
    criarSnapshot,
    restaurarSnapshot,
    excluirSnapshot,
    iniciarAuto,
    lembretePendente,
    listarSnapshots: () => DB.db.snapshots.reverse().sortBy('criadoEm'),
    _baixar: baixarArquivo,
  };
})(self);
