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

  function mascaraTelefone(valor) {
    const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function mascaraCnpj(valor) {
    const d = String(valor || '').replace(/\D/g, '').slice(0, 14);
    if (!d) return '';
    let out = d.slice(0, 2);
    if (d.length > 2) out += '.' + d.slice(2, 5);
    if (d.length > 5) out += '.' + d.slice(5, 8);
    if (d.length > 8) out += '/' + d.slice(8, 12);
    if (d.length > 12) out += '-' + d.slice(12, 14);
    return out;
  }

  function fmtCnpj(raw) {
    const d = String(raw || '').replace(/\D/g, '');
    if (d.length !== 14) return raw || '';
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }

  function redimensionarImagem(arquivo, maxLado = 512, qualidade = 0.8) {
    return new Promise((resolve, reject) => {
      if (!arquivo || !/^image\//.test(arquivo.type || '')) {
        return reject(new Error('O arquivo escolhido não é uma imagem.'));
      }
      const leitor = new FileReader();
      leitor.onerror = () => reject(new Error('Falha ao ler a imagem.'));
      leitor.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagem inválida.'));
        img.onload = () => {
          const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * escala));
          const h = Math.max(1, Math.round(img.height * escala));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', qualidade));
        };
        img.src = String(leitor.result);
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  function verImagem({ src, titulo = '', subtitulo = '' }) {
    if (!src) return;
    const overlay = document.createElement('div');
    overlay.className = 'img-viewer';
    overlay.innerHTML = `
      <button class="img-viewer-fechar" type="button" aria-label="Fechar">✕</button>
      <figure class="img-viewer-corpo">
        <img src="${esc(src)}" alt="${esc(titulo)}">
        ${titulo ? `<figcaption><b>${esc(titulo)}</b>${subtitulo ? `<br><small>${esc(subtitulo)}</small>` : ''}</figcaption>` : ''}
      </figure>`;
    const aoTecla = (e) => {
      if (e.key === 'Escape') fechar();
    };
    function fechar() {
      document.removeEventListener('keydown', aoTecla);
      overlay.remove();
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fechar();
    });
    overlay.querySelector('.img-viewer-fechar').addEventListener('click', fechar);
    document.addEventListener('keydown', aoTecla);
    document.body.appendChild(overlay);
  }

  function fmtTelefone(raw) {
    const d = String(raw || '').replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return raw || '';
  }

  function wppNumero(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.length >= 10 && d.length <= 11 && !d.startsWith('55')) d = '55' + d;
    return d;
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

  function promptDialog(titulo, camposHtml, botaoOk, aoAbrir) {
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
      if (aoAbrir) aoAbrir(d);
      d.querySelector('#dlgNao').onclick = () => { d.close(); resolve(null); };
      d.querySelector('#dlgSim').onclick = () => {
        const dados = {};
        d.querySelectorAll('[name]').forEach((i) => (dados[i.name] = i.value));
        d.close();
        resolve(dados);
      };
    });
  }

  const api = {
    fmtMoeda,
    parseMoedaParaCentavos,
    hojeISO,
    mesAtualISO,
    fmtData,
    fmtDataCurta,
    fmtDataHora,
    fmtTelefone,
    wppNumero,
    mascaraTelefone,
    mascaraCnpj,
    fmtCnpj,
    redimensionarImagem,
    verImagem,
    esc,
    toast,
    confirmar,
    promptDialog,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Util = api;
})(typeof self !== 'undefined' ? self : this);
