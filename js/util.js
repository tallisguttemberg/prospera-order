(function (root) {
  'use strict';

  function fmtMoeda(centavos) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format((centavos || 0) / 100);
  }

  function parseMoedaParaCentavos(valorStr) {
    const n = Number(String(valorStr).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  function hojeISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dia}`;
  }

  function mesAtualISO() {
    return hojeISO().slice(0, 7);
  }

  function fmtData(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  function fmtDataHora(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtDataCurta(iso) {
    if (!iso) return '';
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toast(msg, tipo) {
    let t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (tipo || '');
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => (t.className = 'toast'), 2600);
  }

  function confirmar(titulo, msg, botaoOk) {
    return new Promise((resolve) => {
      const d = document.getElementById('dlg');
      d.innerHTML = `
        <h3>${esc(titulo)}</h3>
        <p class="dlg-msg">${msg}</p>
        <div class="dlg-acoes">
          <button class="btn ghost" id="dlgNao">Cancelar</button>
          <button class="btn primary" id="dlgSim">${esc(botaoOk || 'Confirmar')}</button>
        </div>`;
      d.showModal();
      d.querySelector('#dlgNao').onclick = () => { d.close(); resolve(false); };
      d.querySelector('#dlgSim').onclick = () => { d.close(); resolve(true); };
    });
  }

  function promptDialog(titulo, camposHtml, botaoOk) {
    return new Promise((resolve) => {
      const d = document.getElementById('dlg');
      d.innerHTML = `
        <h3>${esc(titulo)}</h3>
        ${camposHtml}
        <div class="dlg-acoes">
          <button class="btn ghost" id="dlgNao">Cancelar</button>
          <button class="btn primary" id="dlgSim">${esc(botaoOk || 'Salvar')}</button>
        </div>`;
      d.showModal();
      d.querySelector('#dlgNao').onclick = () => { d.close(); resolve(null); };
      d.querySelector('#dlgSim').onclick = () => {
        const dados = {};
        d.querySelectorAll('[name]').forEach((i) => (dados[i.name] = i.value));
        d.close();
        resolve(dados);
      };
    });
  }

  root.Util = {
    fmtMoeda,
    parseMoedaParaCentavos,
    hojeISO,
    mesAtualISO,
    fmtData,
    fmtDataCurta,
    fmtDataHora,
    esc,
    toast,
    confirmar,
    promptDialog,
  };
})(self);
