(function (root) {
  'use strict';

  const estadoInicial = () => ({
    atual: '0',
    anterior: null,
    op: null,
    novoNum: true,
    erro: false,
  });

  function paraNumero(s) {
    return parseFloat(String(s).replace(',', '.')) || 0;
  }

  function calcular(a, b, op) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
      default: return b;
    }
  }

  function formatar(estado) {
    if (estado.erro) return 'Erro';
    const n = paraNumero(estado.atual);
    if (!Number.isFinite(n)) return 'Erro';
    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 10,
    }).format(n);
  }

  function processar(estadoAnterior, tecla) {
    let e = { ...estadoAnterior };
    if (e.erro && tecla !== 'C') return e;

    if (/^[0-9]$/.test(tecla)) {
      if (e.novoNum) {
        e.atual = tecla === '0' ? '0' : tecla;
        e.novoNum = false;
      } else {
        if (e.atual.replace(/[-,]/g, '').length >= 12) return e;
        e.atual = e.atual === '0' ? tecla : e.atual + tecla;
      }
      return e;
    }

    if (tecla === ',') {
      if (e.novoNum) {
        e.atual = '0,';
        e.novoNum = false;
        return e;
      }
      if (!e.atual.includes(',')) e.atual += ',';
      return e;
    }

    if (['+', '-', '*', '/'].includes(tecla)) {
      if (e.op !== null && !e.novoNum) {
        const r = calcular(paraNumero(e.anterior), paraNumero(e.atual), e.op);
        if (!Number.isFinite(r)) return { ...estadoInicial(), erro: true };
        e.anterior = String(r);
        e.atual = String(r);
      } else if (e.anterior === null) {
        e.anterior = e.atual;
      }
      e.op = tecla;
      e.novoNum = true;
      return e;
    }

    if (tecla === '=') {
      if (e.op === null || e.anterior === null || e.novoNum) {
        e.novoNum = true;
        return e;
      }
      const r = calcular(paraNumero(e.anterior), paraNumero(e.atual), e.op);
      if (!Number.isFinite(r)) return { ...estadoInicial(), erro: true };
      e.atual = String(Math.round(r * 1e10) / 1e10);
      e.anterior = null;
      e.op = null;
      e.novoNum = true;
      return e;
    }

    if (tecla === '%') {
      const n = paraNumero(e.atual);
      const r =
        e.op !== null && e.anterior !== null
          ? (paraNumero(e.anterior) * n) / 100
          : n / 100;
      e.atual = String(Math.round(r * 1e10) / 1e10);
      e.novoNum = false;
      return e;
    }

    if (tecla === '+/-') {
      if (e.atual.startsWith('-')) e.atual = e.atual.slice(1);
      else if (paraNumero(e.atual) !== 0) e.atual = '-' + e.atual;
      return e;
    }

    if (tecla === 'backspace') {
      if (e.novoNum) return e;
      e.atual = e.atual.slice(0, -1);
      if (e.atual === '' || e.atual === '-') e.atual = '0';
      return e;
    }

    if (tecla === 'C') return estadoInicial();

    return e;
  }

  const TECLAS = ['C', 'backspace', '%', '/', '7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+', '+/-', '0', ',', '='];
  const ROTULOS = { backspace: '⌫', '+/-': '±', '*': '×', '/': '÷', '-': '−' };

  const CHAVE_STORE = 'prospera-calc-widget';
  const ESCALA_MIN = 0.8;
  const ESCALA_MAX = 1.4;
  const PASSO_ESCALA = 0.15;

  function carregarPosicao() {
    try {
      const p = JSON.parse(localStorage.getItem(CHAVE_STORE));
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
    } catch {}
    return null;
  }

  function salvarPosicao(p) {
    try {
      localStorage.setItem(CHAVE_STORE, JSON.stringify(p));
    } catch {}
  }

  function limitarNaTela(x, y, el) {
    const r = el.getBoundingClientRect();
    const maxX = window.innerWidth - Math.min(r.width, window.innerWidth * 0.95);
    const maxY = window.innerHeight - 60;
    return {
      x: Math.min(Math.max(4, x), Math.max(4, maxX)),
      y: Math.min(Math.max(4, y), Math.max(4, maxY)),
    };
  }

  function classe(t) {
    if (t === '=') return 'igual';
    if (['/', '*', '-', '+'].includes(t)) return 'op';
    if (['C', 'backspace', '%', '+/-'].includes(t)) return 'funcao';
    return '';
  }

  let estadoGlobal = null;

  function alternar() {
    const w = document.getElementById('calcWidget');
    if (!w || w.hidden) abrir();
    else fechar();
  }

  function abrir() {
    let w = document.getElementById('calcWidget');
    if (!w) {
      montarUI();
      w = document.getElementById('calcWidget');
    }
    w.hidden = false;
    requestAnimationFrame(() => w.classList.add('aberto'));

    let estado = estadoInicial();
    estadoGlobal = estado;
    const display = w.querySelector('#calcDisplay');
    const atualizar = () => {
      display.textContent = formatar(estado);
      display.classList.toggle('erro', estado.erro);
    };

    w.querySelectorAll('.calc-tecla').forEach((b) => {
      b.onclick = () => {
        estado = processar(estado, b.dataset.t);
        estadoGlobal = estado;
        atualizar();
      };
    });

    w.querySelector('#calcFechar').onclick = fechar;

    const btnMenos = w.querySelector('#calcMenos');
    const btnMais = w.querySelector('#calcMais');
    const aplicarEscala = () => {
      const pos = carregarPosicao() || {};
      const esc = pos.escala || 1;
      w.style.setProperty('--esc', esc);
    };
    btnMenos.onclick = () => mudarEscala(-PASSO_ESCALA);
    btnMais.onclick = () => mudarEscala(PASSO_ESCALA);
    aplicarEscala();

    const salvo = carregarPosicao();
    let px = salvo ? salvo.x : window.innerWidth - w.offsetWidth - 20;
    let py = salvo ? salvo.y : window.innerHeight - w.offsetHeight - 100;
    ({ x: px, y: py } = limitarNaTela(px, py, w));
    w.style.left = px + 'px';
    w.style.top = py + 'px';
    w.style.right = 'auto';
    w.style.bottom = 'auto';

    const alca = w.querySelector('.calc-topo');
    alca.onpointerdown = (ev) => {
      if (ev.target.closest('button')) return;
      ev.preventDefault();
      alca.setPointerCapture(ev.pointerId);
      const offX = ev.clientX - px;
      const offY = ev.clientY - py;
      const mover = (e2) => {
        ({ x: px, y: py } = limitarNaTela(e2.clientX - offX, e2.clientY - offY, w));
        w.style.left = px + 'px';
        w.style.top = py + 'px';
      };
      const soltar = () => {
        alca.removeEventListener('pointermove', mover);
        alca.removeEventListener('pointerup', soltar);
        alca.removeEventListener('pointercancel', soltar);
        salvarPosicao({ ...carregarPosicao(), x: px, y: py });
      };
      alca.addEventListener('pointermove', mover);
      alca.addEventListener('pointerup', soltar);
      alca.addEventListener('pointercancel', soltar);
    };

    document.addEventListener('keydown', function onKey(ev) {
      if (!estadoVisivel()) {
        document.removeEventListener('keydown', onKey);
        return;
      }
      if (ev.key === 'Escape') return fechar();
      const mapa = { Enter: '=', '=': '=', Backspace: 'backspace', c: 'C', C: 'C', '.': ',', ',': ',' };
      const t = /^[0-9+\-*/%]$/.test(ev.key) ? ev.key : mapa[ev.key];
      if (t) {
        if (ev.target.matches('input, select, textarea')) return;
        ev.preventDefault();
        estado = processar(estado, t);
        estadoGlobal = estado;
        atualizar();
      }
    });
  }

  function mudarEscala(delta) {
    const pos = carregarPosicao() || {};
    let esc = (pos.escala || 1) + delta;
    esc = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, Math.round(esc * 100) / 100));
    salvarPosicao({ ...pos, escala: esc });
    const w = document.getElementById('calcWidget');
    w.style.setProperty('--esc', esc);
    const { x, y } = limitarNaTela(parseFloat(w.style.left) || 0, parseFloat(w.style.top) || 0, w);
    w.style.left = x + 'px';
    w.style.top = y + 'px';
    salvarPosicao({ ...carregarPosicao(), x, y });
  }

  function estadoVisivel() {
    const w = document.getElementById('calcWidget');
    return w && !w.hidden;
  }

  function fechar() {
    const w = document.getElementById('calcWidget');
    if (!w) return;
    w.classList.remove('aberto');
    setTimeout(() => (w.hidden = true), 160);
  }

  function montarUI() {
    const antigo = document.getElementById('calcWidget');
    if (antigo) antigo.remove();
    const w = document.createElement('div');
    w.id = 'calcWidget';
    w.className = 'calc-widget';
    w.hidden = true;
    w.innerHTML = `
      <div class="calc-topo">
        <span class="calc-agarrar">⠿</span>
        <div class="calc-acoes">
          <button id="calcMenos" aria-label="Diminuir tamanho">−</button>
          <button id="calcMais" aria-label="Aumentar tamanho">＋</button>
          <button id="calcFechar" aria-label="Fechar calculadora">✕</button>
        </div>
      </div>
      <div class="calc-display" id="calcDisplay">0</div>
      <div class="calc-grid">
        ${TECLAS.map((t) => `<button class="calc-tecla ${classe(t)}" data-t="${t}">${ROTULOS[t] || t}</button>`).join('')}
      </div>`;
    document.body.appendChild(w);
  }

  const api = { alternar, abrir, fechar, processar, formatar, estadoInicial, montarUI };
  if (typeof module !== 'undefined' && module.exports) {
    delete api.abrir;
    delete api.fechar;
    delete api.montarUI;
    module.exports = api;
  } else {
    root.Calculadora = api;
  }
})(typeof self !== 'undefined' ? self : this);
