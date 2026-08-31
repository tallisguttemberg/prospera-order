(function (root) {
  'use strict';

  const U = Util;
  const LOCALIDADES = root.LOCALIDADES || [];
  const state = {
    view: 'home',
    diaTab: 'carga',
    mes: null,
    clienteId: null,
    busca: '',
    qtdVenda: {},
    vendaClienteId: '',
    acompFiltro: 'todos',
    acompOrdena: 'atraso',
  };

  const TITULOS = {
    diaria: 'Diária',
    clientes: 'Clientes',
    cliente: 'Cliente',
    produtos: 'Produtos',
    relatorios: 'Relatórios',
    acompanhamento: 'Visitas',
    ajustes: 'Ajustes',
  };

  const SLOGAN = 'Anote. Venda. Prospere.';

  const VERSAO = '2.0.0';

  async function senhaExclusaoConfere(senhaDigitada) {
    const senha = await DB.getConfig('senhaExclusao');
    if (!senha) return true;
    return senhaDigitada === senha;
  }

  async function init() {
    try {
      if (!root.Dexie || !root.DB || !root.Calc) {
        throw new Error('Falha ao carregar módulos do aplicativo.');
      }
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        try {
          await navigator.serviceWorker.register('sw.js');
        } catch (e) {}
      }
      await Backup.iniciarAuto();
      await Acomp.migrar();
      const nome = await DB.getConfig('vendedorNome');
      if (!nome) {
        const r = await U.promptDialog(
          'Bem-vindo!',
          `<label class="field"><span>Seu nome</span><input name="nome" placeholder="Ex: João"></label>
           <label class="field"><span>Empresa que representa</span><input name="empresa" placeholder="Digite NENHUMA se não tiver"></label>
           <label class="field"><span>Seu WhatsApp</span><input name="whatsapp" inputmode="tel" placeholder="(88) 90000-0000"></label>`,
          'Começar'
        );
        if (r) {
          const telDig = (r.whatsapp || '').replace(/\D/g, '');
          if (!r.nome || !r.nome.trim()) return U.toast('Informe seu nome.', 'erro');
          if (telDig.length < 10) return U.toast('Informe um WhatsApp válido.', 'erro');
          const empresa = (r.empresa || '').trim().toUpperCase() === 'NENHUMA' ? '' : (r.empresa || '').trim();
          await DB.setConfig('vendedorNome', r.nome.trim());
          await DB.setConfig('empresaNome', empresa);
          await DB.setConfig('vendedorWhatsapp', U.mascaraTelefone(telDig));
          await DB.setConfig('empresaContato', U.mascaraTelefone(telDig));
          const senha = await U.promptDialog(
            'Senha de exclusão',
            `<label class="field"><span>Defina uma senha para excluir dados</span>
              <input name="senha" type="password" inputmode="numeric" autocomplete="off" placeholder="••••••"></label>
             <small class="muted">Ela será pedida sempre que você for excluir qualquer item no sistema.</small>`,
            'Salvar'
          );
          if (senha && senha.senha.trim()) {
            await DB.setConfig('senhaExclusao', senha.senha.trim());
          } else {
            return U.toast('A senha de exclusão é obrigatória.', 'erro');
          }
        }
      }
      go('home');
    } catch (e) {
      document.getElementById('view').innerHTML = `
        <div class="card center">
          <p class="big">⚠️</p>
          <h3>Algo deu errado ao iniciar</h3>
          <p class="muted small">${U.esc(e.message || 'Erro desconhecido')}<br>
          Se você abriu o arquivo direto do gerenciador, use o endereço <b>http://localhost:8090</b> no navegador.</p>
          <button class="btn primary block" onclick="location.reload()">Tentar novamente</button>
        </div>`;
    }
  }

  function go(view, params = {}) {
    state.view = view;
    state.diaIdAberto = params.diaIdAberto ?? null;
    Object.assign(state, params);
    if (view === 'diaria' && !params.diaIdAberto) state.diaIdAberto = null;
    render();
  }

  function setTabAtiva() {
    document.querySelectorAll('.tabbar button').forEach((b) => {
      b.classList.toggle('ativo', b.dataset.view === state.view);
    });
  }

  async function render() {
    const view = document.getElementById('view');
    document.getElementById('subtitulo').textContent =
      state.view === 'home'
        ? SLOGAN
        : state.view === 'cliente'
          ? 'Cliente'
          : TITULOS[state.view] || '';
    document.getElementById('btnVoltar').hidden = state.view !== 'cliente' && state.view !== 'ajustes';
    setTabAtiva();
    window.scrollTo(0, 0);
    switch (state.view) {
      case 'home': return renderHome(view);
      case 'diaria': return renderDiaria(view);
      case 'clientes': return renderClientes(view);
      case 'cliente': return renderClienteDetalhe(view);
      case 'produtos': return renderProdutos(view);
      case 'relatorios': return renderRelatorios(view);
      case 'acompanhamento': return renderAcompanhamento(view);
      case 'ajustes': return renderAjustes(view);
    }
  }

  async function renderHome(el) {
    const [nome, hoje, lembrete, pendentes] = await Promise.all([
      DB.getConfig('vendedorNome'),
      DB.diariaAberta(),
      Backup.lembretePendente(),
      Acomp.clientesPendentes(),
    ]);
    const mes = U.mesAtualISO();
    const { resumo } = await Relatorios.dadosDoPeriodo(mes);
    const ultimas = (await DB.db.diarias.orderBy('data').reverse().limit(7).toArray());
    let html = '';
    if (pendentes.length) {
      html += `
        <div class="banner visita" role="button" onclick="App.go('acompanhamento')">
          <div>
            <b>Clientes para visitar!</b><br>
            <small>Você possui ${pendentes.length} cliente(s) que precisam de visita.</small>
          </div>
          <span class="seta">›</span>
        </div>`;
    }
    if (lembrete) {
      html += `
        <div class="banner">
          <div>
            <b>Hora do backup!</b><br>
            <small>Faça uma cópia do arquivo para proteger seus dados.</small>
          </div>
          <button class="btn small primary" onclick="App.fazerBackup()">Fazer</button>
        </div>`;
    }
    html += `<p class="saudacao">Olá${nome ? ', <b>' + U.esc(nome) + '</b>' : ''}! 👋</p>`;
    if (hoje) {
      const { cargas, vendas } = await DB.dadosDiaria(hoje.id);
      const produtos = await DB.db.produtos.toArray();
      const r = Calc.resumoDiaria(cargas, vendas, [], produtos.filter((p) => p.ativo));
      html += `
        <div class="card destaque">
          <h3>Diária de hoje está aberta</h3>
          <div class="mini-stats">
            <div><span>${r.porProduto.reduce((s, p) => s + p.pego, 0)}</span><small>Pegas</small></div>
            <div><span>${r.arrecadadoCentavos ? U.fmtMoeda(r.arrecadadoCentavos) : 'R$ 0,00'}</span><small>Vendido</small></div>
            <div><span>${U.fmtMoeda(r.ganhoCentavos)}</span><small>Seu ganho</small></div>
          </div>
          <button class="btn primary block" onclick="App.go('diaria')">Continuar diária</button>
        </div>`;
    } else {
      html += `
        <div class="card destaque">
          <h3>Nenhuma diária aberta</h3>
          <p class="muted">Registre a carga que você pegou com o fornecedor para começar o dia.</p>
          <button class="btn primary block" onclick="App.abrirDiaria()">Abrir diária de hoje</button>
        </div>`;
    }
    html += `
      <div class="card">
        <div class="card-top"><h3>Este mês</h3><button class="link" onclick="App.go('relatorios')">ver tudo</button></div>
        <div class="linha-resumo">
          <div><small>Faturamento</small><b>${U.fmtMoeda(resumo.faturamentoCentavos)}</b></div>
          <div><small>Seu ganho</small><b class="ok">${U.fmtMoeda(resumo.ganhoCentavos)}</b></div>
          <div><small>Dias c/ venda</small><b>${resumo.diasComVenda}</b></div>
        </div>
      </div>`;
    if (ultimas.length) {
      const ids = ultimas.map((d) => d.id);
      const vendas = await DB.db.vendas.where('diariaId').anyOf(ids).toArray();
      html += '<div class="card"><h3>Últimos dias</h3>';
      for (const d of ultimas) {
        const vs = vendas.filter((v) => v.diariaId === d.id);
        const ganho = vs.reduce((s, v) => s + v.unidades * v.comissaoUnitCentavos, 0);
        const fat = vs.reduce((s, v) => s + v.unidades * v.valorUnitCentavos, 0);
        html += `
          <button class="item-lista" onclick="App.verDia(${d.id})">
            <div><b>${U.fmtDataCurta(d.data)}</b> ${d.status === 'aberta' ? '<span class="tag">aberta</span>' : ''}
              <br><small class="muted">${vs.length} venda(s)</small></div>
            <div class="dir"><b>${U.fmtMoeda(fat)}</b><br><small class="ok">+${U.fmtMoeda(ganho)}</small></div>
          </button>`;
      }
      html += '</div>';
    }
    el.innerHTML = html;
  }

  async function abrirDiaria() {
    const hoje = U.hojeISO();
    const doDia = await DB.db.diarias.where('data').equals(hoje).first();

    if (doDia && doDia.status === 'aberta') {
      state.qtdVenda = {};
      go('diaria', { diaIdAberto: doDia.id });
      return;
    }

    const presas = (await DB.db.diarias.where('status').equals('aberta').toArray()).filter(
      (d) => d.data !== hoje
    );
    if (presas.length) {
      const datas = [...new Set(presas.map((d) => U.fmtData(d.data)))].join(', ');
      const ok = await U.confirmar(
        'Diária anterior ficou aberta',
        `Existe diária de <b>${U.esc(datas)}</b> ainda em aberto.<br><small class="muted">Fechar agora para iniciar a de hoje? Você confere os números depois em Relatórios.</small>`,
        'Fechar e iniciar hoje'
      );
      if (!ok) return;
      await DB.db.diarias.bulkUpdate(
        presas.map((d) => ({ key: d.id, changes: { status: 'fechada', fechadaEm: Date.now() } }))
      );
    }

    if (doDia && doDia.status === 'fechada') {
      const ok = await U.confirmar(
        'Diária de hoje já foi fechada',
        'Reabrir a diária de hoje para fazer novos lançamentos?',
        'Reabrir'
      );
      if (!ok) return;
      await DB.db.diarias.update(doDia.id, { status: 'aberta', fechadaEm: null });
      state.qtdVenda = {};
      go('diaria', { diaIdAberto: doDia.id });
      return;
    }

    await DB.db.diarias.add({ data: hoje, status: 'aberta', abertaEm: Date.now(), fechadaEm: null });
    state.qtdVenda = {};
    go('diaria');
  }

  async function verDia(id) {
    await DB.db.diarias.get(id);
    go('diaria', { diaIdAberto: id });
  }

  async function renderDiaria(el) {
    let dia = null;
    if (state.diaIdAberto) {
      dia = await DB.db.diarias.get(state.diaIdAberto);
      if (dia) state.diaTab = 'resumo';
    } else {
      dia = await DB.diariaAberta();
    }
    if (!dia) {
      el.innerHTML = `
        <div class="card destaque center">
          <p class="big">📦</p>
          <h3>Nenhuma diária aberta</h3>
          <p class="muted">Ao abrir, registre a carga retirada do fornecedor.</p>
          <button class="btn primary block" onclick="App.abrirDiaria()">Abrir diária de hoje</button>
        </div>`;
      return;
    }
    state.diaIdAberto = dia.id;
    el.innerHTML = `
      <div class="sub-tabs" id="subTabs">
        ${['carga', 'vendas', 'devolucao', 'resumo'].map(
          (t) => `<button data-t="${t}" class="${state.diaTab === t ? 'ativo' : ''}" onclick="App.setDiaTab('${t}')">${
            { carga: 'Carga', vendas: 'Vendas', devolucao: 'Devolução', resumo: 'Resumo' }[t]
          }</button>`
        ).join('')}
      </div>
      <div id="diaTabContent"></div>`;
    await renderDiaTab();
  }

  async function renderDiaTab() {
    const box = document.getElementById('diaTabContent');
    if (!box) return;
    const dia = await DB.db.diarias.get(state.diaIdAberto);
    const produtos = await DB.produtosAtivos();
    const { cargas, vendas, devolucoes } = await DB.dadosDiaria(dia.id);
    switch (state.diaTab) {
      case 'carga': return tabCarga(box, dia, produtos, cargas);
      case 'vendas': return tabVendas(box, dia, produtos, vendas);
      case 'devolucao': return tabDevolucao(box, dia, produtos, cargas, vendas, devolucoes);
      case 'resumo': return tabResumo(box, dia, produtos, cargas, vendas, devolucoes);
    }
  }

  async function tabCarga(box, dia, produtos, cargas) {
    const porProduto = new Map();
    for (const c of cargas) {
      porProduto.set(c.produtoId, (porProduto.get(c.produtoId) || 0) + c.unidades);
    }
    let html = `<div class="card"><h3>Registrar carga retirada</h3>`;
    if (!produtos.length) html += '<p class="muted">Cadastre produtos primeiro.</p>';
    for (const p of produtos) {
      html += `
        <div class="form-linha">
          <b>${U.esc(p.nome)}</b>
          <small class="muted">${U.fmtMoeda(p.precoCentavos)} · caixa com ${p.unidPorCaixa}</small>
          <div class="grupo-inputs">
            <label><small>Caixas</small><input type="number" inputmode="numeric" min="0" id="cx-${p.id}" value="0"></label>
            <label><small>Avulsas</small><input type="number" inputmode="numeric" min="0" id="av-${p.id}" value="0"></label>
            <button class="btn primary small" onclick="App.salvarCarga(${p.id})">+</button>
          </div>
        </div>`;
    }
    html += '</div>';
    if (cargas.length) {
      html += `<div class="card"><h3>Cargas do dia</h3>`;
      for (const c of cargas.slice().reverse()) {
        const p = await DB.db.produtos.get(c.produtoId);
        html += `
          <div class="item-lista div">
            <div><b>${c.unidades}</b> × ${U.esc(p ? p.nome : 'Removido')}</div>
            <button class="icon-btn" onclick="App.apagarCarga(${c.id})">🗑</button>
          </div>`;
      }
      html += '</div>';
    }
    box.innerHTML = html;
  }

  async function diaTravado() {
    const d = await DB.db.diarias.get(state.diaIdAberto);
    if (d && d.status === 'fechada') {
      U.toast('Este dia está fechado — reabra no Resumo para editar.', 'erro');
      return true;
    }
    return false;
  }

  async function salvarCarga(produtoId) {
    if (await diaTravado()) return;
    const p = await DB.db.produtos.get(produtoId);
    const cx = document.getElementById(`cx-${produtoId}`).value;
    const av = document.getElementById(`av-${produtoId}`).value;
    const v = Calc.validarCarga(p.unidPorCaixa, cx, av);
    if (!v.ok) return U.toast(v.motivo, 'erro');
    await DB.db.cargas.add({ diariaId: state.diaIdAberto, produtoId, unidades: v.unidades });
    U.toast(`+${v.unidades} ${p.nome}`);
    await renderDiaTab();
  }

  async function apagarCarga(id) {
    if ((await diaTravado()) || !(await U.confirmar('Remover carga', 'Remover este lançamento de carga?'))) return;
    await DB.db.cargas.delete(id);
    await renderDiaTab();
  }

  async function tabVendas(box, dia, produtos, vendas) {
    const clientes = await DB.db.clientes.where('ativo').equals(1).sortBy('nome');
    const todosProdutos = await DB.db.produtos.toArray();
    const nomesProduto = new Map(todosProdutos.map((p) => [p.id, p.nome]));
    if (!state.vendaClienteId && clientes.length) state.vendaClienteId = String(clientes[0].id);
    let html = '';
    if (!clientes.length) {
      html += `<div class="card"><p class="muted">Cadastre um cliente antes de vender.</p>
        <button class="btn primary block" onclick="App.go('clientes')">Ir para Clientes</button></div>`;
    }
    html += `
      <div class="card">
        <h3>Nova venda</h3>
        <label class="field"><span>Cliente</span>
          <select id="selCliente" onchange="App.trocarClienteSel(this.value)">
            ${clientes.map((c) => `<option value="${c.id}" ${String(c.id) === state.vendaClienteId ? 'selected' : ''}>${U.esc(c.nome)}</option>`).join('')}
          </select>
        </label>
        ${produtos.map((p) => {
          const q = state.qtdVenda[p.id] || 0;
          return `
          <div class="venda-produto">
            <div><b>${U.esc(p.nome)}</b><br><small class="muted">${U.fmtMoeda(p.precoCentavos)} · você ganha ${U.fmtMoeda(p.comissaoCentavos)}</small></div>
            <div class="stepper">
              <button onclick="App.stepper(${p.id}, -1)">−</button>
              <span id="qtd-${p.id}">${q}</span>
              <button onclick="App.stepper(${p.id}, 1)">+</button>
            </div>
          </div>`;
        }).join('')}
        <button class="btn primary block" onclick="App.registrarVenda()">Registrar venda</button>
      </div>`;
    if (vendas.length) {
      const grupos = new Map();
      for (const v of vendas) grupos.set(v.clienteId, [...(grupos.get(v.clienteId) || []), v]);
      html += '<div class="card"><h3>Vendas registradas</h3>';
      for (const [cid, vs] of grupos) {
        const c = await DB.db.clientes.get(cid);
        const total = vs.reduce((s, v) => s + v.unidades * v.valorUnitCentavos, 0);
        html += `<div class="venda-grupo">
          <div class="venda-grupo-top"><b>${U.esc(c ? c.nome : 'Removido')}</b><b>${U.fmtMoeda(total)}</b></div>
          ${vs.map((v) => {
            const nomeP = nomesProduto.get(v.produtoId) || 'Produto removido';
            return `<div class="item-lista div">
              <div>${v.unidades} × ${U.esc(nomeP)}
                <br><small class="muted">${U.fmtMoeda(v.unidades * v.valorUnitCentavos)}</small></div>
              <button class="icon-btn" onclick="App.apagarVenda(${v.id})">🗑</button>
            </div>`;
          }).join('')}
          <button class="btn ghost block" onclick="App.exportarPdfCliente(${cid})">📄 Enviar PDF</button>
        </div>`;
      }
      html += '</div>';
    }
    box.innerHTML = html;
  }

  function trocarClienteSel(v) {
    state.vendaClienteId = v;
  }

  async function stepper(produtoId, delta) {
    state.qtdVenda[produtoId] = Math.max(0, (state.qtdVenda[produtoId] || 0) + delta);
    const span = document.getElementById(`qtd-${produtoId}`);
    if (span) span.textContent = state.qtdVenda[produtoId];
  }

  async function registrarVenda() {
    if (await diaTravado()) return;
    const itens = Object.entries(state.qtdVenda).filter(([, q]) => q > 0);
    if (!itens.length) return U.toast('Escolha a quantidade de pelo menos um produto.', 'erro');
    if (!state.vendaClienteId) return U.toast('Selecione um cliente.', 'erro');
    const clienteId = Number(state.vendaClienteId);
    const registros = [];
    for (const [pid, q] of itens) {
      const p = await DB.db.produtos.get(Number(pid));
      registros.push({
        diariaId: state.diaIdAberto,
        clienteId,
        produtoId: p.id,
        unidades: q,
        valorUnitCentavos: p.precoCentavos,
        comissaoUnitCentavos: p.comissaoCentavos,
        criadoEm: Date.now(),
      });
    }
    await DB.db.vendas.bulkAdd(registros);
    await Acomp.marcarVisita(clienteId, U.hojeISO());
    state.qtdVenda = {};
    U.toast('Venda registrada! ✅');
    await renderDiaTab();
  }

  async function apagarVenda(id) {
    if ((await diaTravado()) || !(await U.confirmar('Remover venda', 'Remover esta venda do dia?'))) return;
    const v = await DB.db.vendas.get(id);
    await DB.db.vendas.delete(id);
    if (v) await Acomp.recalcularUltimaVisita(v.clienteId);
    await renderDiaTab();
  }

  async function tabDevolucao(box, dia, produtos, cargas, vendas, devolucoes) {
    let html = '<div class="card"><h3>O que sobrou na sacola</h3>';
    if (!cargas.length) html += '<p class="muted">Nenhuma carga registrada neste dia ainda.</p>';
    for (const p of produtos) {
      const t = Calc.totaisProduto(cargas, vendas, devolucoes, p.id);
      const jaDev = devolucoes.filter((d) => d.produtoId === p.id).reduce((s, d) => s + d.unidades, 0);
      html += `
        <div class="dev-item">
          <div><b>${U.esc(p.nome)}</b><br>
            <small class="muted">pego ${t.pego} · vendido ${t.vendido} · devolvido ${jaDev}</small></div>
          <label><small>Devolver agora</small>
            <input type="number" inputmode="numeric" min="0" max="${t.restante}" value="0" id="dev-${p.id}">
          </label>
        </div>`;
    }
    html += `
      <button class="btn primary block" onclick="App.salvarDevolucoes()">Registrar devolução</button>
      <p class="muted small">Devolução maior que o restante será bloqueada automaticamente.</p>
    </div>`;
    if (devolucoes.length) {
      html += '<div class="card"><h3>Devoluções do dia</h3>';
      for (const d of devolucoes.slice().reverse()) {
        const p = await DB.db.produtos.get(d.produtoId);
        html += `
          <div class="item-lista div">
            <div><b>${d.unidades}</b> × ${U.esc(p ? p.nome : 'Removido')}</div>
            <button class="icon-btn" onclick="App.apagarDevolucao(${d.id})">🗑</button>
          </div>`;
      }
      html += '</div>';
    }
    box.innerHTML = html;
  }

  async function salvarDevolucoes() {
    if (await diaTravado()) return;
    const dia = state.diaIdAberto;
    const produtos = await DB.db.produtos.toArray();
    const { cargas, vendas, devolucoes } = await DB.dadosDiaria(dia);
    const novas = [];
    for (const p of produtos) {
      const input = document.getElementById(`dev-${p.id}`);
      if (!input) continue;
      const t = Calc.totaisProduto(cargas, vendas, devolucoes, p.id);
      const v = Calc.validarDevolucao(t.restante, input.value);
      if (!v.ok && input.value !== '0' && input.value !== '') {
        return U.toast(`${p.nome}: ${v.motivo}`, 'erro');
      }
      if (v.ok && v.qtd > 0) novas.push({ diariaId: dia, produtoId: p.id, unidades: v.qtd });
    }
    if (!novas.length) return U.toast('Nada para devolver.', 'erro');
    await DB.db.devolucoes.bulkAdd(novas);
    U.toast('Devolução registrada! ✅');
    await renderDiaTab();
  }

  async function apagarDevolucao(id) {
    if ((await diaTravado()) || !(await U.confirmar('Remover devolução', 'Remover este registro de devolução?'))) return;
    await DB.db.devolucoes.delete(id);
    await renderDiaTab();
  }

  async function tabResumo(box, dia, produtos, cargas, vendas, devolucoes) {
    const r = Calc.resumoDiaria(cargas, vendas, devolucoes, produtos);
    const temRestante = r.porProduto.some((p) => p.restante !== 0);
    let html = `
      <div class="cards-resumo">
        <div class="stat"><small>Arrecadado</small><b>${U.fmtMoeda(r.arrecadadoCentavos)}</b></div>
        <div class="stat"><small>A pagar ao fornecedor</small><b>${U.fmtMoeda(r.pagarFornecedorCentavos)}</b></div>
        <div class="stat verde"><small>Seu ganho</small><b>${U.fmtMoeda(r.ganhoCentavos)}</b></div>
      </div>
      <div class="card">
        <h3>Por produto</h3>
        <table class="tabela">
          <tr><th>Produto</th><th>Pego</th><th>Vend.</th><th>Dev.</th><th>Sobra</th></tr>
          ${r.porProduto.map((p) => `
            <tr class="${p.restante < 0 ? 'erro-linha' : ''}">
              <td>${U.esc(p.nome)}</td><td>${p.pego}</td><td>${p.vendido}</td><td>${p.devolvido}</td>
              <td class="${p.restante < 0 ? 'erro' : p.restante > 0 ? 'alerta' : 'ok'}">${p.restante}</td>
            </tr>`).join('')}
        </table>
      </div>
      <div class="card">
        <h3>📤 Enviar ao fornecedor</h3>
        ${vendas.length ? `
          <p class="muted small">Pedido do dia detalhado por cliente, com bairro, referência e contato.</p>
          <button class="btn primary block" onclick="App.compartilharFornecedor()">📤 Compartilhar pedido</button>
          <div class="row-gap">
            <button class="btn ghost small" onclick="App.whatsappFornecedor()">WhatsApp</button>
            <button class="btn ghost small" onclick="App.copiarFornecedor()">📋 Copiar</button>
          </div>` : '<p class="muted">Registre vendas para gerar o pedido.</p>'}
      </div>`;
    if (dia.status === 'aberta') {
      html += `
        ${temRestante ? '<p class="aviso">⚠ Há mercadoria sem destino. Registre devolução ou confira as quantidades.</p>' : ''}
        <button class="btn primary block" onclick="App.fecharDia()">${temRestante ? 'Fechar dia mesmo assim' : 'Fechar o dia'}</button>`;
    } else {
      html += `
        <div class="card center">
          <span class="tag fechado">✔ Dia fechado em ${U.fmtDataHora(dia.fechadaEm)}</span>
          <div class="row-gap">
            <button class="btn ghost" onclick="App.copiarResumo()">📋 Copiar resumo</button>
            <button class="btn danger ghost" onclick="App.reabrirDia()">Reabrir dia</button>
          </div>
        </div>`;
    }
    html += `
      <div class="card">
        <button class="btn danger ghost block" style="margin-top:0" onclick="App.excluirDiaria()">🗑 Excluir esta diária</button>
        <p class="muted small center">Solicita senha de administrador.</p>
      </div>`;
    box.innerHTML = html;
  }

  async function fecharDia() {
    const ok = await U.confirmar('Fechar o dia', 'O dia ficará travado para edição. Confirma?', 'Fechar dia');
    if (!ok) return;
    await DB.db.diarias.update(state.diaIdAberto, { status: 'fechada', fechadaEm: Date.now() });
    U.toast('Dia fechado! 💰');
    await renderDiaTab();
  }

  async function reabrirDia() {
    const ok = await U.confirmar('Reabrir o dia', 'Permitir edições nesta diária novamente?', 'Reabrir');
    if (!ok) return;
    const outra = await DB.diariaAberta();
    if (outra) return U.toast('Feche a diária aberta antes de reabrir outra.', 'erro');
    await DB.db.diarias.update(state.diaIdAberto, { status: 'aberta', fechadaEm: null });
    await renderDiaTab();
  }

  let textoFornecedorAtual = '';

  async function montarTextoFornecedor() {
    const dia = await DB.db.diarias.get(state.diaIdAberto);
    const { cargas, vendas, devolucoes } = await DB.dadosDiaria(dia.id);
    if (!vendas.length && !cargas.length) {
      U.toast('Nada registrado nesta diária ainda.', 'erro');
      return null;
    }
    const [todosProdutos, todosClientes] = await Promise.all([
      DB.db.produtos.toArray(),
      DB.db.clientes.toArray(),
    ]);
    const prodMap = new Map(todosProdutos.map((p) => [p.id, p]));
    const cliMap = new Map(todosClientes.map((c) => [c.id, c]));

    const detalheCaixas = (un, produto) => {
      if (!produto || !produto.unidPorCaixa || produto.unidPorCaixa <= 1) return '';
      const cx = Math.floor(un / produto.unidPorCaixa);
      const avulsas = un % produto.unidPorCaixa;
      if (cx && avulsas) return ` (${cx} caixa${cx > 1 ? 's' : ''} + ${avulsas} un)`;
      if (cx) return ` (${cx} caixa${cx > 1 ? 's' : ''})`;
      return ' (avulsas)';
    };

    const agrupar = (lista) => {
      const m = new Map();
      for (const item of lista) m.set(item.produtoId, (m.get(item.produtoId) || 0) + item.unidades);
      return m;
    };
    const estoqueMap = agrupar(cargas);
    const devMap = agrupar(devolucoes);

    let arrecadadoCentavos = 0;
    let ganhoCentavos = 0;

    const linhas = [
      `📦 PEDIDO DO DIA — ${U.fmtData(dia.data)}`,
      'Prospera Order',
      '',
    ];

    const porCliente = new Map();
    for (const v of vendas) {
      porCliente.set(v.clienteId, [...(porCliente.get(v.clienteId) || []), v]);
      arrecadadoCentavos += v.unidades * v.valorUnitCentavos;
      ganhoCentavos += v.unidades * v.comissaoUnitCentavos;
    }

    for (const [clienteId, vs] of porCliente) {
      const c = cliMap.get(clienteId) || {};
      linhas.push(`🏪 ${c.nome || 'Cliente'}`);
      const local = [c.bairro, c.pontoRef].filter(Boolean).join(' — ');
      if (local) linhas.push(`📍 ${local}`);
      if (c.endereco) linhas.push(`🏠 ${c.endereco}`);
      if (c.telefone) linhas.push(`📞 ${U.fmtTelefone(c.telefone)}`);
      let subtotalCliente = 0;
      for (const v of vs) {
        const p = prodMap.get(v.produtoId);
        const totalItem = v.unidades * v.valorUnitCentavos;
        subtotalCliente += totalItem;
        linhas.push(`   • ${p ? p.nome : 'Produto'}: ${v.unidades} un — ${U.fmtMoeda(totalItem)}`);
      }
      linhas.push(`   ➜ Subtotal: ${U.fmtMoeda(subtotalCliente)}`);
      linhas.push('');
    }

    linhas.push('━━━━━━━━━━━━');
    linhas.push('📊 RESUMO DO DIA');
    linhas.push('');

    linhas.push('📥 Estoque retirado:');
    for (const [produtoId, un] of estoqueMap) {
      const p = prodMap.get(produtoId);
      linhas.push(`   • ${p ? p.nome : 'Produto'}: ${un} un${detalheCaixas(un, p)}`);
    }
    if (!estoqueMap.size) linhas.push('   • nenhum registro de carga');

    linhas.push('');
    linhas.push('↩️ Devoluções:');
    for (const [produtoId, un] of devMap) {
      const p = prodMap.get(produtoId);
      const valorDev = un * ((p || {}).precoCentavos || 0);
      linhas.push(`   • ${p ? p.nome : 'Produto'}: ${un} un — ${U.fmtMoeda(valorDev)}`);
    }
    if (!devMap.size) linhas.push('   • nada devolvido');

    linhas.push('');
    linhas.push('💰 Vendas:');
    const totaisVenda = agrupar(vendas);
    for (const [produtoId, un] of totaisVenda) {
      const p = prodMap.get(produtoId);
      const totalProd = vendas
        .filter((v) => v.produtoId === produtoId)
        .reduce((s, v) => s + v.unidades * v.valorUnitCentavos, 0);
      linhas.push(`   • ${p ? p.nome : 'Produto'}: ${un} un — ${U.fmtMoeda(totalProd)}`);
    }

    const pagarFornecedorCentavos = arrecadadoCentavos - ganhoCentavos;
    linhas.push('');
    linhas.push(`💵 Arrecadado: ${U.fmtMoeda(arrecadadoCentavos)}`);
    linhas.push(`🏭 A pagar ao fornecedor: ${U.fmtMoeda(pagarFornecedorCentavos)}`);
    linhas.push(`🤝 Minha comissão: ${U.fmtMoeda(ganhoCentavos)}`);

    textoFornecedorAtual = linhas.join('\n');
    return textoFornecedorAtual;
  }

  async function compartilharFornecedor() {
    const texto = await montarTextoFornecedor();
    if (!texto) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Pedido do dia — Prospera Order', text: texto });
        U.toast('Enviado!');
      } catch (e) {}
    } else {
      await copiarTexto(texto);
      U.toast('Copiado! Cole no WhatsApp do fornecedor.');
    }
  }

  async function whatsappFornecedor() {
    const texto = await montarTextoFornecedor();
    if (!texto) return;
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
  }

  async function copiarFornecedor() {
    const texto = textoFornecedorAtual || (await montarTextoFornecedor());
    if (!texto) return;
    await copiarTexto(texto);
    U.toast('Pedido copiado! 📋');
  }

  async function copiarTexto(texto) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  async function excluirDiaria() {
    const r = await U.promptDialog(
      'Excluir diária',
      `<label class="field"><span>Senha de exclusão</span>
        <input name="senha" type="password" inputmode="numeric" autocomplete="off" placeholder="••••••"></label>`,
      'Continuar'
    );
    if (!r) return;
    const senhaVálida = await senhaExclusaoConfere(r.senha);
    if (!senhaVálida) {
      return U.toast('Senha incorreta.', 'erro');
    }
    const dia = await DB.db.diarias.get(state.diaIdAberto);
    if (!dia) return U.toast('Diária não encontrada.', 'erro');
    const ok = await U.confirmar(
      'Apagar definitivamente',
      `Apagar <b>tudo</b> da diária de <b>${U.fmtData(dia.data)}</b>?<br><small class="muted">Cargas, vendas e devoluções serão removidos. Não dá para desfazer.</small>`,
      'Apagar'
    );
    if (!ok) return;
    await DB.db.transaction('rw', ['diarias', 'cargas', 'vendas', 'devolucoes'], async () => {
      await DB.db.cargas.where('diariaId').equals(dia.id).delete();
      await DB.db.vendas.where('diariaId').equals(dia.id).delete();
      await DB.db.devolucoes.where('diariaId').equals(dia.id).delete();
      await DB.db.diarias.delete(dia.id);
    });
    state.diaIdAberto = null;
    U.toast('Diária excluída. 🗑');
    go('relatorios');
  }

  async function copiarResumo() {    const dia = await DB.db.diarias.get(state.diaIdAberto);
    const produtos = await DB.produtosAtivos();
    const { cargas, vendas, devolucoes } = await DB.dadosDiaria(dia.id);
    const r = Calc.resumoDiaria(cargas, vendas, devolucoes, produtos);
    const linhas = [
      `📊 Resumo — ${U.fmtData(dia.data)}`,
      ...r.porProduto.map((p) => `${p.nome}: pego ${p.pego} | vendido ${p.vendido} | devolvido ${p.devolvido}`),
      '',
      `Arrecadado: ${U.fmtMoeda(r.arrecadadoCentavos)}`,
      `A pagar fornecedor: ${U.fmtMoeda(r.pagarFornecedorCentavos)}`,
      `Meu ganho: ${U.fmtMoeda(r.ganhoCentavos)}`,
    ];
    const texto = linhas.join('\n');
    await copiarTexto(texto);
    U.toast('Resumo copiado!');
  }

  function setDiaTab(t) {
    state.diaTab = t;
    document.querySelectorAll('#subTabs button').forEach((b) =>
      b.classList.toggle('ativo', b.dataset.t === t)
    );
    renderDiaTab();
  }

  async function renderClientes(el) {
    const clientes = await DB.db.clientes.orderBy('nome').toArray();
    const filtro = state.busca.toLowerCase();
    const lista = clientes.filter((c) => c.nome.toLowerCase().includes(filtro));
    el.innerHTML = `
      <div class="busca-row">
        <input type="search" placeholder="Buscar cliente..." value="${U.esc(state.busca)}"
          oninput="App.buscar(this.value)">
        <button class="btn primary" onclick="App.formCliente()">+ Novo</button>
      </div>
      <div class="card">
        ${lista.length ? lista.map((c) => `
          <button class="item-lista" onclick="App.go('cliente',{clienteId:${c.id}})">
            <div><b>${U.esc(c.nome)}</b>${c.ativo ? '' : ' <span class="tag off">inativo</span>'}
              <br>${c.telefone && c.telefone.replace(/\D/g, '')
                ? `<small><a class="link-wpp" href="https://wa.me/${U.wppNumero(c.telefone)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">📞 ${U.esc(U.fmtTelefone(c.telefone))}</a></small>`
                : '<small class="muted">Sem telefone</small>'}</div>
            <span class="seta">›</span>
          </button>`).join('')
        : '<p class="muted center">Nenhum cliente cadastrado.</p>'}
      </div>`;
  }

  function buscar(v) {
    state.busca = v;
    renderClientes(document.getElementById('view'));
  }

  async function formCliente(id) {
    const c = id
      ? await DB.db.clientes.get(id)
      : { nome: '', telefone: '', cnpj: '', endereco: '', bairro: '', pontoRef: '', estado: '', cidade: '', obs: '', ativo: 1 };
    const cidadesDe = (uf) => ((LOCALIDADES.find((e) => e.uf === uf) || {}).cidades || []);
    const optsCidades = (uf, sel) =>
      ['<option value="">Selecione...</option>']
        .concat(
          cidadesDe(uf).map(
            (cid) => `<option value="${U.esc(cid)}"${cid === sel ? ' selected' : ''}>${U.esc(cid)}</option>`
          )
        )
        .join('');
    const optsEstados = ['<option value="">Selecione...</option>']
      .concat(
        LOCALIDADES.map(
          (e) => `<option value="${e.uf}"${e.uf === c.estado ? ' selected' : ''}>${U.esc(e.nome)} (${e.uf})</option>`
        )
      )
      .join('');
    const campos = `
      <label class="field"><span>Nome do estabelecimento *</span><input name="nome" value="${U.esc(c.nome)}" placeholder="Ex: Mercado Central"></label>
      <label class="field"><span>Responsável pela compra *</span><input name="responsavel" value="${U.esc(c.responsavel || '')}" placeholder="Ex: João Silva"></label>
      <label class="field"><span>Telefone / WhatsApp *</span><input name="telefone" value="${U.esc(c.telefone || '')}" inputmode="tel" placeholder="(88) 90000-0000"></label>
      <label class="field"><span>CNPJ</span><input name="cnpj" value="${U.esc(c.cnpj || '')}" inputmode="numeric" placeholder="00.000.000/0000-00 (opcional)"></label>
      <div class="grid-2">
        <label class="field"><span>Bairro *</span><input name="bairro" value="${U.esc(c.bairro || '')}" placeholder="Ex: Centro"></label>
        <label class="field"><span>Ponto de referência</span><input name="pontoRef" value="${U.esc(c.pontoRef || '')}" placeholder="Ex: perto da igreja"></label>
      </div>
      <label class="field"><span>Endereço *</span><input name="endereco" value="${U.esc(c.endereco || '')}" placeholder="Rua, número..."></label>
      <div class="grid-2">
        <label class="field"><span>Estado</span><select name="estado" id="selEstado">${optsEstados}</select></label>
        <label class="field"><span>Cidade</span><select name="cidade" id="selCidade">${optsCidades(c.estado, c.cidade)}</select></label>
      </div>
      <label class="field"><span>Obs.</span><input name="obs" value="${U.esc(c.obs || '')}" placeholder="Observação extra (opcional)"></label>`;
    const r = await U.promptDialog(
      id ? 'Editar cliente' : 'Novo cliente',
      campos,
      undefined,
      (dlg) => {
        const tel = dlg.querySelector('input[name="telefone"]');
        if (tel) {
          tel.addEventListener('input', () => {
            tel.value = U.mascaraTelefone(tel.value);
          });
        }
        const cnpj = dlg.querySelector('input[name="cnpj"]');
        if (cnpj) {
          cnpj.addEventListener('input', () => {
            cnpj.value = U.mascaraCnpj(cnpj.value);
          });
        }
        const selEstado = dlg.querySelector('#selEstado');
        if (selEstado) {
          selEstado.addEventListener('change', () => {
            const selCidade = dlg.querySelector('#selCidade');
            selCidade.innerHTML = optsCidades(selEstado.value, '');
          });
        }
      }
    );
    if (!r) return;
    if (!r.nome.trim()) return U.toast('O nome do estabelecimento é obrigatório.', 'erro');
    if (!r.responsavel.trim()) return U.toast('O nome do responsável pela compra é obrigatório.', 'erro');
    const telDigitos = r.telefone.replace(/\D/g, '');
    if (!telDigitos) return U.toast('O telefone é obrigatório.', 'erro');
    if (telDigitos.length < 10) return U.toast('Telefone incompleto — digite DDD + número.', 'erro');
    const cnpjDigitos = (r.cnpj || '').replace(/\D/g, '');
    if (cnpjDigitos && cnpjDigitos.length !== 14) return U.toast('CNPJ incompleto — deixe vazio ou digite os 14 números.', 'erro');
    if (!r.bairro.trim()) return U.toast('O bairro é obrigatório.', 'erro');
    if (!r.endereco.trim()) return U.toast('O endereço é obrigatório.', 'erro');
    const dados = {
      nome: r.nome.trim(),
      responsavel: r.responsavel.trim(),
      telefone: r.telefone.trim(),
      cnpj: cnpjDigitos ? U.mascaraCnpj(cnpjDigitos) : '',
      endereco: r.endereco.trim(),
      bairro: r.bairro.trim(),
      pontoRef: r.pontoRef.trim(),
      estado: r.estado || '',
      cidade: r.cidade || '',
      obs: (r.obs || '').trim(),
    };
    if (id) await DB.db.clientes.update(id, dados);
    else await DB.db.clientes.add({ ...dados, ativo: 1, criadoEm: Date.now() });
    U.toast(id ? 'Cliente atualizado!' : 'Cliente cadastrado! ✅');
    render();
  }

  async function excluirCliente() {
    const c = await DB.db.clientes.get(state.clienteId);
    if (!c) return go('clientes');
    const r = await U.promptDialog(
      'Excluir cliente',
      `<label class="field"><span>Senha de exclusão</span>
        <input name="senha" type="password" inputmode="numeric" autocomplete="off" placeholder="••••••"></label>`,
      'Continuar'
    );
    if (!r) return;
    const senhaVálida = await senhaExclusaoConfere(r.senha);
    if (!senhaVálida) {
      return U.toast('Senha incorreta.', 'erro');
    }
    const vendasCliente = await DB.db.vendas.where('clienteId').equals(c.id).count();
    const aviso =
      vendasCliente > 0
        ? `<br><small class="muted">Este cliente tem ${vendasCliente} venda(s) no histórico — elas permanecem nos relatórios como "Removido".</small>`
        : '<br><small class="muted">Sem histórico de vendas, a exclusão é segura.</small>';
    const ok = await U.confirmar(
      'Apagar definitivamente',
      `Excluir <b>${U.esc(c.nome)}</b>?${aviso}`,
      'Apagar'
    );
    if (!ok) return;
    await DB.db.transaction('rw', ['clientes', 'visitas'], async () => {
      await DB.db.visitas.where('clienteId').equals(c.id).delete();
      await DB.db.clientes.delete(c.id);
    });
    U.toast('Cliente excluído. 🗑');
    go('clientes');
  }

  async function renderClienteDetalhe(el) {
    const c = await DB.db.clientes.get(state.clienteId);
    if (!c) return go('clientes');
    const vendas = await DB.db.vendas.where('clienteId').equals(c.id).toArray();
    const diariasIds = [...new Set(vendas.map((v) => v.diariaId))];
    const diarias = await DB.db.diarias.bulkGet(diariasIds);
    const dataPor = new Map(diarias.map((d) => [d.id, d]));
    const produtos = await DB.db.produtos.toArray();
    const prodMap = new Map(produtos.map((p) => [p.id, p]));
    const total = vendas.reduce((s, v) => s + v.unidades * v.valorUnitCentavos, 0);
    const porData = new Map();
    for (const v of vendas) {
      const key = v.diariaId;
      porData.set(key, [...(porData.get(key) || []), v]);
    }
    const ordenadas = [...porData.entries()].sort((a, b) =>
      ((dataPor.get(b[0]) || {}).data || '').localeCompare((dataPor.get(a[0]) || {}).data || '')
    );
    const cardVisita = await cardVisitaCliente(c);
    el.innerHTML = `
      <div class="card">
        <div class="card-top">
          <h3>${U.esc(c.nome)}</h3>
          <div>
            <button class="link" onclick="App.formCliente(${c.id})">editar</button>
            <button class="link danger" onclick="App.toggleCliente(${c.id},${c.ativo ? 0 : 1})">${c.ativo ? 'desativar' : 'ativar'}</button>
            <button class="link danger" onclick="App.excluirCliente()">🗑 excluir</button>
          </div>
        </div>
        ${c.responsavel ? `<p>👤 Resp.: ${U.esc(c.responsavel)}</p>` : ''}
        ${c.cnpj ? `<p class="muted">🏢 CNPJ: ${U.esc(U.fmtCnpj(c.cnpj))}</p>` : ''}
        ${c.telefone && c.telefone.replace(/\D/g, '')
          ? `<p>📞 <a class="link-wpp" href="https://wa.me/${U.wppNumero(c.telefone)}" target="_blank" rel="noopener noreferrer">${U.esc(U.fmtTelefone(c.telefone))}</a></p>`
          : ''}
        ${c.bairro || c.pontoRef ? `<p class="muted">📍 ${U.esc([c.bairro, c.pontoRef].filter(Boolean).join(' — '))}</p>` : ''}
        ${c.cidade || c.estado ? `<p class="muted">🏛 ${U.esc([c.cidade, c.estado].filter(Boolean).join(' - '))}</p>` : ''}
        ${c.endereco ? `<p class="muted">🏠 ${U.esc(c.endereco)}</p>` : ''}
        ${c.obs ? `<p class="muted">📝 Obs.: ${U.esc(c.obs)}</p>` : ''}
        <div class="linha-resumo">
          <div><small>Total comprado</small><b>${U.fmtMoeda(total)}</b></div>
          <div><small>Pedidos</small><b>${ordenadas.length}</b></div>
        </div>
      </div>
      ${cardVisita}
      ${ordenadas.map(([did, vs]) => {
        const d = dataPor.get(did);
        const tot = vs.reduce((s, v) => s + v.unidades * v.valorUnitCentavos, 0);
        return `
        <div class="card">
          <div class="card-top"><b>${U.fmtData((d || {}).data)}</b><b>${U.fmtMoeda(tot)}</b></div>
          ${vs.map((v) => `<div class="item-lista div"><div>${v.unidades} × ${U.esc((prodMap.get(v.produtoId) || {}).nome || 'Removido')}</div>
            <small class="muted">${U.fmtMoeda(v.unidades * v.valorUnitCentavos)}</small></div>`).join('')}
        </div>`;
      }).join('')}`;
  }

  async function toggleCliente(id, novoStatus) {
    if (!novoStatus) {
      const ok = await U.confirmar('Desativar cliente', 'Ele sai das listas de venda, mas o histórico é mantido.', 'Desativar');
      if (!ok) return;
    }
    await DB.db.clientes.update(id, { ativo: novoStatus });
    go('clientes');
  }

  function legendaVisita(aval) {
    switch (aval.status) {
      case 'sem-visita':
        return 'Nunca visitado — registre a primeira visita.';
      case 'atrasada':
        return `${aval.diasDesde} dia(s) sem visita. A próxima já era para ${U.fmtData(aval.proximaVisita)}.`;
      case 'hoje':
        return 'Visita programada para hoje — não deixe passar!';
      case 'proxima':
        return `Faltam ${aval.diasRestantes} dia(s) para a próxima visita (${U.fmtData(aval.proximaVisita)}).`;
      default:
        return `Em dia — próximo ciclo em ${U.fmtData(aval.proximaVisita)} (${aval.diasRestantes} dia(s)).`;
    }
  }

  async function cardVisitaCliente(c) {
    const aval = Acomp.avaliar(c, U.hojeISO());
    const st = Acomp.STATUS_INFO[aval.status];
    const hist = await Acomp.historico(c.id);
    return `
      <div class="card card-visita">
        <div class="card-top">
          <h3>🕓 Acompanhamento de visitas</h3>
          <span class="tag visita ${st.classe}">${st.emoji} ${st.rotulo}</span>
        </div>
        <div class="linha-resumo">
          <div><small>Última visita</small><b>${aval.ultimaVisita ? U.fmtData(aval.ultimaVisita) : 'Nunca'}</b></div>
          <div><small>Próxima visita</small><b>${aval.proximaVisita ? U.fmtData(aval.proximaVisita) : '—'}</b></div>
        </div>
        <p class="muted small" style="margin:8px 0 0">${U.esc(legendaVisita(aval))}</p>
        <div class="row-gap">
          <button class="btn primary" onclick="App.registrarVisita(${c.id})">📋 Registrar visita</button>
          ${(c.telefone || '').replace(/\D/g, '')
            ? `<a class="btn ghost" href="https://wa.me/${U.wppNumero(c.telefone)}?text=${encodeURIComponent('Olá! Passando para registrar a visita. 😊')}" target="_blank" rel="noopener noreferrer">💬 Chamar</a>`
            : ''}
        </div>
      </div>
      <div class="card">
        <h3>Histórico de visitas</h3>
        ${hist.length
          ? hist.map((h) => `
            <div class="item-lista div">
              <div><b>${U.fmtData(h.data)}</b><br><small class="muted">Visita realizada</small></div>
            </div>`).join('')
          : '<p class="muted">Nenhuma visita registrada ainda.</p>'}
      </div>`;
  }

  async function registrarVisita(clienteId) {
    const c = await DB.db.clientes.get(clienteId);
    if (!c) return;
    const hoje = U.hojeISO();
    const r = await U.promptDialog(
      'Registrar visita',
      `<label class="field"><span>Data da visita</span>
        <input name="data" type="date" value="${hoje}" max="${hoje}"></label>
       <p class="muted small">A próxima visita será recalculada para 15 dias após a data informada.</p>`,
      'Registrar'
    );
    if (!r) return;
    if (!r.data) return U.toast('Informe a data da visita.', 'erro');
    if (r.data > hoje) return U.toast('A data não pode ser no futuro.', 'erro');
    await Acomp.marcarVisita(clienteId, r.data);
    U.toast('Visita registrada! 🎉');
    render();
  }

  async function renderAcompanhamento(el) {
    const hoje = U.hojeISO();
    const clientes = await DB.db.clientes.toArray();
    const aval = Acomp.avaliarTodos(clientes, hoje);
    const grupos = Acomp.agrupar(aval);
    const contagem = (s) => (grupos.get(s) || []).length;
    const filtro = state.acompFiltro;
    const ordena = state.acompOrdena;

    const chips = [
      ['todos', `Todos (${aval.length})`],
      ['atrasada', `Atrasadas (${contagem('atrasada')})`],
      ['hoje', `Hoje (${contagem('hoje')})`],
      ['proxima', `Próximas (${contagem('proxima')})`],
      ['em-dia', `Em dia (${contagem('em-dia')})`],
      ['sem-visita', `Sem visita (${contagem('sem-visita')})`],
    ];

    el.innerHTML = `
      <div class="mini-stats">
        <div><span class="erro">${contagem('atrasada')}</span><small>Atrasadas</small></div>
        <div><span class="hj-c">${contagem('hoje')}</span><small>Hoje</small></div>
        <div><span class="alerta">${contagem('proxima')}</span><small>Próximas</small></div>
        <div><span class="ok">${contagem('em-dia')}</span><small>Em dia</small></div>
      </div>
      ${contagem('sem-visita')
        ? `<p class="muted small">⚪ ${contagem('sem-visita')} cliente(s) ainda sem visita registrada.</p>`
        : ''}
      <div class="card">
        <div class="chipbar">
          ${chips.map(([v, rot]) => `
            <button class="chip ${filtro === v ? 'ativo' : ''}" onclick="App.setAcompFiltro('${v}')">${U.esc(rot)}</button>`).join('')}
        </div>
        <label class="field" style="margin-bottom:0"><span>Ordenar por</span>
          <select onchange="App.setAcompOrdena(this.value)">
            <option value="atraso" ${ordena === 'atraso' ? 'selected' : ''}>Mais atrasados primeiro</option>
            <option value="proxima" ${ordena === 'proxima' ? 'selected' : ''}>Próxima visita</option>
            <option value="nome" ${ordena === 'nome' ? 'selected' : ''}>Nome do cliente</option>
          </select>
        </label>
      </div>
      ${renderListaAcomp(grupos, filtro, ordena)}`;
  }

  function renderListaAcomp(grupos, filtro, ordena) {
    if (filtro === 'todos') {
      const secoes = [
        ['atrasada', '🔴 VISITAS ATRASADAS'],
        ['hoje', '🔵 VISITA HOJE'],
        ['proxima', '🟠 VISITAS PRÓXIMAS'],
        ['em-dia', '🟢 EM DIA'],
        ['sem-visita', '⚪ SEM VISITA REGISTRADA'],
      ];
      let html = '';
      for (const [status, titulo] of secoes) {
        const itens = Acomp.ordenar(grupos.get(status) || [], ordena);
        if (!itens.length) continue;
        html += `<div class="card"><h3>${titulo}</h3>${itens.map(itemAcomp).join('')}</div>`;
      }
      if (!html) html = '<div class="card center"><p class="muted">Nenhum cliente cadastrado.</p></div>';
      return html;
    }
    const itens = Acomp.ordenar(grupos.get(filtro) || [], ordena);
    if (!itens.length) return '<div class="card center"><p class="muted">Nenhum cliente neste grupo.</p></div>';
    return `<div class="card">${itens.map(itemAcomp).join('')}</div>`;
  }

  function itemAcomp(e) {
    const st = Acomp.STATUS_INFO[e.status];
    const c = e.cliente;
    let sub;
    if (e.status === 'sem-visita') {
      sub = 'Nunca visitado — considere agendar a primeira visita.';
    } else {
      sub =
        `Últ. visita ${U.fmtData(e.ultimaVisita)} · ` +
        (e.status === 'atrasada'
          ? `<b class="erro">${e.diasDesde} dia(s) sem visita</b>`
          : e.status === 'hoje'
            ? '<b class="hj-c">programada para hoje</b>'
            : `próx. ${U.fmtData(e.proximaVisita)} · faltam <b>${e.diasRestantes}</b> dia(s)`);
    }
    return `
      <button class="item-lista" onclick="App.go('cliente',{clienteId:${c.id}})">
        <div>
          <b>${U.esc(c.nome)}</b> <span class="tag visita ${st.classe}">${st.emoji} ${st.rotulo}</span>
          <br><small class="muted">${sub}</small>
        </div>
        <span class="seta">›</span>
      </button>`;
  }

  function setAcompFiltro(v) {
    state.acompFiltro = v;
    render();
  }

  function setAcompOrdena(v) {
    state.acompOrdena = v;
    render();
  }

  async function renderProdutos(el) {
    const produtos = await DB.db.produtos.orderBy('nome').toArray();
    const usados = new Set([
      ...(await DB.db.cargas.toArray()).map((c) => c.produtoId),
      ...(await DB.db.vendas.toArray()).map((v) => v.produtoId),
    ]);
    el.innerHTML = `
      <div class="busca-row">
        <span class="muted">${produtos.length} produto(s)</span>
        <button class="btn primary" onclick="App.formProduto()">+ Novo</button>
      </div>
      <div class="card">
        ${produtos.map((p) => `
          <div class="item-lista div">
            ${p.imagem && p.imagem.startsWith('data:image')
              ? `<img class="thumb-produto" alt="" src="${p.imagem}" title="Ver foto"
                   onclick="event.stopPropagation(); App.verImagemProduto(${p.id})">`
              : '<span class="thumb-produto sem-foto">🛒</span>'}
            <div onclick="App.formProduto(${p.id})" style="flex:1">
              <b>${U.esc(p.nome)}</b>${p.ativo ? '' : ' <span class="tag off">inativo</span>'}
              <br><small class="muted">${U.fmtMoeda(p.precoCentavos)}${p.gramatura ? ' · ' + U.esc(p.gramatura) + 'g' : ''} · caixa ${p.unidPorCaixa} un · ganho ${U.fmtMoeda(p.comissaoCentavos)}/un</small>
            </div>
            ${usados.has(p.id)
              ? `<button class="link danger" onclick="App.toggleProduto(${p.id},${p.ativo ? 0 : 1})">${p.ativo ? 'desativar' : 'ativar'}</button>`
              : `<button class="icon-btn" onclick="App.excluirProduto(${p.id})">🗑</button>`}
          </div>`).join('')}
      </div>`;
  }

  async function formProduto(id) {
    const p = id
      ? await DB.db.produtos.get(id)
      : { nome: '', descricao: '', gramatura: '', imagem: '', precoCentavos: 0, comissaoCentavos: 50, unidPorCaixa: 1 };
    const temImagem = !!(p.imagem && p.imagem.startsWith('data:image'));
    let imagemFinal = temImagem ? p.imagem : '';
    const campos = `
      <label class="field"><span>Nome *</span><input name="nome" value="${U.esc(p.nome)}" placeholder="Ex: Rosquinha 300g"></label>
      <div class="field">
        <span>Foto do produto</span>
        <div class="img-linha">
          <img id="imgPreview" class="img-preview" alt="" ${temImagem ? `src="${p.imagem}"` : 'hidden'}>
          <div class="img-acoes">
            <button type="button" class="btn ghost small" id="btnEscolherImg">📷 Escolher</button>
            <button type="button" class="btn ghost small danger" id="btnRemoverImg" ${temImagem ? '' : 'hidden'}>Remover</button>
          </div>
          <small class="muted" id="imgDica">${temImagem ? '' : 'Opcional — ajuda a reconhecer na hora da venda.'}</small>
        </div>
        <input type="file" id="inpImagem" accept="image/*" hidden>
      </div>
      <label class="field"><span>Descrição</span><input name="descricao" value="${U.esc(p.descricao || '')}" placeholder="Ex: Pacote de 300g"></label>
      <div class="grid-2">
        <label class="field"><span>Gramatura (g)</span><input name="gramatura" type="number" step="1" min="0" value="${U.esc(p.gramatura || '')}" inputmode="numeric" placeholder="Ex: 400 (opcional)"></label>
        <label class="field"><span>Unidades por caixa *</span><input name="unid" type="number" step="1" min="1" value="${p.unidPorCaixa}"></label>
      </div>
      <div class="grid-2">
        <label class="field"><span>Preço de venda (R$) *</span><input name="preco" type="number" step="0.01" min="0" value="${(p.precoCentavos / 100).toFixed(2)}"></label>
        <label class="field"><span>Sua comissão/un (R$)</span><input name="comissao" type="number" step="0.01" min="0" value="${(p.comissaoCentavos / 100).toFixed(2)}"></label>
      </div>`;
    const r = await U.promptDialog(
      id ? 'Editar produto' : 'Novo produto',
      campos,
      undefined,
      (dlg) => {
        const inp = dlg.querySelector('#inpImagem');
        const prev = dlg.querySelector('#imgPreview');
        const btnEscolher = dlg.querySelector('#btnEscolherImg');
        const btnRemover = dlg.querySelector('#btnRemoverImg');
        const dica = dlg.querySelector('#imgDica');
        if (!inp) return;
        btnEscolher.addEventListener('click', () => inp.click());
        inp.addEventListener('change', async () => {
          const f = inp.files[0];
          if (!f) return;
          try {
            imagemFinal = await U.redimensionarImagem(f);
            prev.src = imagemFinal;
            prev.hidden = false;
            btnRemover.hidden = false;
            dica.textContent = '';
          } catch (e) {
            U.toast(e.message || 'Não foi possível carregar a imagem.', 'erro');
          }
          inp.value = '';
        });
        btnRemover.addEventListener('click', () => {
          imagemFinal = '';
          prev.removeAttribute('src');
          prev.hidden = true;
          btnRemover.hidden = true;
          dica.textContent = 'Foto removida — salve para confirmar.';
        });
      }
    );
    if (!r) return;
    if (!r.nome.trim()) return U.toast('O nome é obrigatório.', 'erro');
    const preco = U.parseMoedaParaCentavos(r.preco);
    const comissao = U.parseMoedaParaCentavos(r.comissao || '0');
    const unid = parseInt(r.unid, 10);
    let gramatura = null;
    if ((r.gramatura || '').trim() !== '') {
      gramatura = parseInt(r.gramatura, 10);
      if (!Number.isFinite(gramatura) || gramatura <= 0) return U.toast('Gramatura inválida.', 'erro');
    }
    if (preco == null || preco <= 0) return U.toast('Preço inválido.', 'erro');
    if (comissao == null || comissao < 0 || comissao >= preco) return U.toast('Comissão inválida (deve ser menor que o preço).', 'erro');
    if (!Number.isFinite(unid) || unid < 1) return U.toast('Unidades por caixa inválidas.', 'erro');
    const dados = {
      nome: r.nome.trim(),
      descricao: r.descricao.trim(),
      gramatura,
      imagem: imagemFinal || '',
      precoCentavos: preco,
      comissaoCentavos: comissao,
      unidPorCaixa: unid,
    };
    if (id) await DB.db.produtos.update(id, dados);
    else await DB.db.produtos.add({ ...dados, ativo: 1, criadoEm: Date.now() });
    U.toast(id ? 'Produto atualizado!' : 'Produto cadastrado! ✅');
    render();
  }

  async function verImagemProduto(id) {
    const p = await DB.db.produtos.get(id);
    if (!p || !p.imagem || !p.imagem.startsWith('data:image')) return;
    U.verImagem({
      src: p.imagem,
      titulo: p.nome,
      subtitulo: `${U.fmtMoeda(p.precoCentavos)}${p.gramatura ? ' · ' + p.gramatura + 'g' : ''}`,
    });
  }

  async function toggleProduto(id, novoStatus) {
    if (!novoStatus) {
      const ok = await U.confirmar('Desativar produto', 'Some das telas de venda/carga; histórico é mantido.', 'Desativar');
      if (!ok) return;
    }
    await DB.db.produtos.update(id, { ativo: novoStatus });
    render();
  }

  async function excluirProduto(id) {
    const r = await U.promptDialog(
      'Excluir produto',
      `<label class="field"><span>Senha de exclusão</span>
        <input name="senha" type="password" inputmode="numeric" autocomplete="off" placeholder="••••••"></label>`,
      'Continuar'
    );
    if (!r) return;
    const senhaVálida = await senhaExclusaoConfere(r.senha);
    if (!senhaVálida) return U.toast('Senha incorreta.', 'erro');
    const ok = await U.confirmar('Excluir produto', 'Excluir permanentemente? Só é possível se nunca foi usado.', 'Excluir');
    if (!ok) return;
    await DB.db.produtos.delete(id);
    render();
  }

  async function renderRelatorios(el) {
    if (!state.mes) state.mes = U.mesAtualISO();
    const { diarias, resumo, clientesById } = await Relatorios.dadosDoPeriodo(state.mes);
    el.innerHTML = `
      <label class="field mes-picker"><span>Mês</span>
        <input type="month" value="${state.mes}" onchange="App.trocarMes(this.value)">
      </label>
      <div class="cards-resumo">
        <div class="stat"><small>Faturamento</small><b>${U.fmtMoeda(resumo.faturamentoCentavos)}</b></div>
        <div class="stat verde"><small>Seu ganho</small><b>${U.fmtMoeda(resumo.ganhoCentavos)}</b></div>
        <div class="stat"><small>Dias c/ venda</small><b>${resumo.diasComVenda}</b></div>
      </div>
      <div class="card">
        <div class="card-top"><h3>Vendas por produto</h3>
          <button class="link" onclick="App.exportarCsv()">⬇ CSV</button></div>
        ${resumo.porProduto.length ? `
        <table class="tabela">
          <tr><th>Produto</th><th>Unids</th><th>Total</th></tr>
          ${resumo.porProduto.map((p) => `
            <tr><td>${U.esc(p.nome)}</td><td>${p.unidades}</td><td>${U.fmtMoeda(p.totalCentavos)}</td></tr>`).join('')}
        </table>` : '<p class="muted">Sem vendas neste mês.</p>'}
      </div>
      <div class="card">
        <h3>Ranking de clientes</h3>
        ${resumo.porCliente.length ? resumo.porCliente.map((c, i) => `
          <div class="item-lista div">
            <div><b>${i + 1}º</b> ${U.esc((clientesById.get(c.clienteId) || {}).nome || 'Removido')}
              <br><small class="muted">${c.unidades} un</small></div>
            <b>${U.fmtMoeda(c.totalCentavos)}</b>
          </div>`).join('') : '<p class="muted">Sem dados.</p>'}
      </div>
      <div class="card">
        <h3>Diárias do mês</h3>
        ${diarias.length ? diarias.slice().reverse().map((d) => `
          <button class="item-lista" onclick="App.verDia(${d.id})">
            <div><b>${U.fmtData(d.data)}</b> ${d.status === 'aberta' ? '<span class="tag">aberta</span>' : '<span class="tag off">fechada</span>'}</div>
            <span class="seta">›</span>
          </button>`).join('') : '<p class="muted">Nenhuma diária neste mês.</p>'}
      </div>`;
  }

  function trocarMes(v) {
    if (!v) return;
    state.mes = v;
    render();
  }

  async function exportarCsv() {
    const csv = await Relatorios.csvVendasDoMes(state.mes);
    Backup._baixar(csv, `vendas-${state.mes}.csv`, 'text/csv;charset=utf-8');
    U.toast('CSV gerado!');
  }

  async function fazerBackup() {
    await Backup.exportarArquivo();
    U.toast('Backup baixado! Guarde com carinho 💾');
  }

  async function importarBackup(input) {
    if (input.files[0]) await Backup.importarArquivo(input.files[0]);
    input.value = '';
  }

  async function renderAjustes(el) {
    const nome = await DB.getConfig('vendedorNome');
    const empresa = await DB.getConfig('empresaNome');
    const whatsapp = await DB.getConfig('vendedorWhatsapp');
    const ultimo = await DB.getConfig('ultimoBackupArquivo');
    const snaps = await Backup.listarSnapshots();
    el.innerHTML = `
      <div class="card">
        <h3>Perfil</h3>
        <label class="field"><span>Seu nome</span>
          <input value="${U.esc(nome || '')}" onchange="App.salvarNome(this.value)" placeholder="Como quer ser chamado?">
        </label>
        <label class="field"><span>Empresa</span>
          <input value="${U.esc(empresa || '')}" onchange="App.salvarEmpresa(this.value)" placeholder="Nome da empresa que representa">
        </label>
        <label class="field"><span>Seu WhatsApp</span>
          <input value="${U.esc(whatsapp || '')}" onchange="App.salvarWhatsapp(this.value)" inputmode="tel" placeholder="(88) 90000-0000">
        </label>
      </div>
      <div class="card">
        <h3>🔒 Senha de exclusão</h3>
        <p class="muted small">Pedida sempre que você for excluir um item (diária, cliente ou produto).</p>
        <label class="field"><span>Nova senha</span>
          <input type="password" inputmode="numeric" autocomplete="off" onchange="App.salvarSenhaExclusao(this.value)" placeholder="●●●●●●">
        </label>
      </div>
      <div class="card">
        <h3>💾 Backup em arquivo</h3>
        <p class="muted small">Último arquivo salvo: ${ultimo ? U.fmtDataHora(ultimo) : 'nunca'}</p>
        <button class="btn primary block" onclick="App.fazerBackup()">Baixar backup agora</button>
        <button class="btn ghost block" onclick="document.getElementById('fileRestore').click()">Restaurar de arquivo...</button>
        <input type="file" id="fileRestore" accept=".json,application/json" hidden onchange="App.importarBackup(this)">
        <p class="muted small">Dica: salve o arquivo no Google Drive ou envie para alguém de confiança toda semana.</p>
      </div>
      <div class="card">
        <div class="card-top"><h3>🔄 Versões automáticas</h3>
          <button class="link" onclick="App.snapshotAgora()">criar agora</button></div>
        <p class="muted small">A cada 2 horas o app guarda uma versão interna (mantém sempre as últimas 20).</p>
        ${snaps.map((s) => `
          <div class="item-lista div">
            <div><b>${U.fmtDataHora(s.criadoEm)}</b>
              <br><small class="muted">${s.origem === 'auto' ? 'automático' : 'manual'} · ${(s.bytes / 1024).toFixed(1)} KB</small></div>
            <div>
              <button class="link" onclick="App.restaurarSnapshot(${s.id})">restaurar</button>
              <button class="link danger" onclick="App.excluirSnapshot(${s.id})">excluir</button>
            </div>
          </div>`).join('')}
      </div>
      <div class="card">
        <h3>📱 Instalar no celular</h3>
        <p class="small"><b>Android (Chrome):</b> menu ⋮ → “Adicionar à tela inicial”.<br>
        <b>iPhone (Safari):</b> botão compartilhar ↑ → “Adicionar à Tela de Início”.</p>
      </div>
      <div class="card">
        <h3>💬 Suporte</h3>
        <a class="btn ghost block" style="text-decoration:none" href="https://wa.me/5588993132963?text=Ol%C3%A1%21%20Preciso%20de%20suporte%20no%20Prospera%20Order." target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>
      </div>
      <p class="center muted small">Prospera Order · v${U.esc(VERSAO)}</p>`;
  }

  async function salvarNome(v) {
    await DB.setConfig('vendedorNome', v.trim());
    U.toast('Salvo!');
  }

  async function salvarEmpresa(v) {
    await DB.setConfig('empresaNome', v.trim());
    U.toast('Salvo!');
  }

  async function salvarWhatsapp(v) {
    const dig = (v || '').replace(/\D/g, '');
    if (dig && dig.length < 10) return U.toast('WhatsApp incompleto.', 'erro');
    const numero = dig ? U.mascaraTelefone(dig) : '';
    await DB.setConfig('vendedorWhatsapp', numero);
    await DB.setConfig('empresaContato', numero);
    U.toast('Salvo!');
  }

  async function salvarSenhaExclusao(v) {
    const s = (v || '').trim();
    if (!s) return U.toast('A senha não pode ficar vazia.', 'erro');
    await DB.setConfig('senhaExclusao', s);
    U.toast('Senha de exclusão atualizada! 🔒');
  }

  async function exportarPdfCliente(clienteId) {
    try {
      const cliente = await DB.db.clientes.get(clienteId);
      if (!cliente) return U.toast('Cliente não encontrado.', 'erro');
      let diaria = null;
      if (state.diaIdAberto) {
        diaria = await DB.db.diarias.get(state.diaIdAberto);
      }
      if (!diaria) {
        diaria = await DB.diariaAberta();
      }
      if (!diaria) return U.toast('Nenhuma diária encontrada.', 'erro');
      const vendas = await DB.db.vendas.where('diariaId').equals(diaria.id).filter((v) => v.clienteId === clienteId).toArray();
      if (!vendas.length) return U.toast('Sem vendas para este cliente.', 'erro');
      const produtos = await DB.db.produtos.toArray();
      const config = {
        vendedorNome: await DB.getConfig('vendedorNome') || '',
        empresaNome: await DB.getConfig('empresaNome') || '',
        empresaContato: await DB.getConfig('empresaContato') || '',
      };
      const doc = PdfExport.vendaCliente(cliente, vendas, produtos, config);
      const nomeArquivo = `venda-${(cliente.nome || 'cliente').replace(/\s+/g, '_')}-${diaria.data}.pdf`;
      await PdfExport.compartilharPdf(doc, nomeArquivo);
      U.toast('PDF pronto!');
    } catch (e) {
      U.toast('Erro ao gerar PDF.', 'erro');
    }
  }

  async function snapshotAgora() {
    await Backup.criarSnapshot('manual');
    U.toast('Versão salva!');
    render();
  }

  async function restaurarSnapshot(id) {
    await Backup.restaurarSnapshot(id);
  }

  async function excluirSnapshot(id) {
    const ok = await U.confirmar('Excluir versão', 'Excluir esta versão salva?', 'Excluir');
    if (!ok) return;
    await Backup.excluirSnapshot(id);
    render();
  }

  root.App = {
    init, go, abrirDiaria, verDia, setDiaTab,
    salvarCarga, apagarCarga,
    stepper, trocarClienteSel, registrarVenda, apagarVenda,
    salvarDevolucoes, apagarDevolucao,
    fecharDia, reabrirDia, copiarResumo, compartilharFornecedor, whatsappFornecedor, copiarFornecedor,
    excluirDiaria,
    buscar, formCliente, toggleCliente, excluirCliente,
    registrarVisita, setAcompFiltro, setAcompOrdena,
    formProduto, toggleProduto, excluirProduto, verImagemProduto,
    trocarMes, exportarCsv,
    fazerBackup, importarBackup, salvarNome, salvarEmpresa, salvarWhatsapp, salvarSenhaExclusao, exportarPdfCliente, snapshotAgora, restaurarSnapshot, excluirSnapshot,
    get state() { return state; },
  };

  document.addEventListener('DOMContentLoaded', init);
})(self);
