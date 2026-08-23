const assert = require('assert');
const Calc2 = require('../js/calculadora.js');

let passou = 0;
function teste(nome, fn) {
  fn();
  passou++;
  console.log('  ok -', nome);
}

function rodar(teclas) {
  let e = Calc2.estadoInicial();
  for (const t of teclas) e = Calc2.processar(e, t);
  return e;
}

console.log('Testes da calculadora:');

teste('soma simples', () => {
  assert.strictEqual(Calc2.formatar(rodar(['1', '0', '+', '5', '='])), '15');
});

teste('operação encadeada usa resultado (10+5, depois ×2 = 30)', () => {
  let e = Calc2.estadoInicial();
  for (const t of ['1', '0', '+', '5', '=', '*', '2', '=']) e = Calc2.processar(e, t);
  assert.strictEqual(Calc2.formatar(e), '30');
});

teste('vírgula decimal pt-BR', () => {
  const e = rodar(['3', ',', '5', '+', '2', ',', '5', '=']);
  assert.strictEqual(Calc2.formatar(e), '6');
});

teste('divisão por zero vira Erro e C recupera', () => {
  let e = rodar(['8', '/', '0', '=']);
  assert.strictEqual(Calc2.formatar(e), 'Erro');
  e = Calc2.processar(e, 'C');
  assert.strictEqual(Calc2.formatar(e), '0');
});

teste('porcentagem como desconto: 100 − 30% = 70', () => {
  assert.strictEqual(Calc2.formatar(rodar(['1', '0', '0', '-', '3', '0', '%', '='])), '70');
});

teste('porcentagem isolada: 50% de si = 0,5', () => {
  assert.strictEqual(Calc2.formatar(rodar(['5', '0', '%'])), '0,5');
});

teste('troca de operador antes do segundo número (2 + × 3)', () => {
  assert.strictEqual(Calc2.formatar(rodar(['2', '+', '*', '3', '='])), '6');
});

teste('± inverte sinal e backspace apaga dígito', () => {
  assert.strictEqual(Calc2.formatar(rodar(['7', '+/-'])), '-7');
  assert.strictEqual(Calc2.formatar(rodar(['1', '2', '3', 'backspace'])), '12');
});

teste('limite de dígitos e novo número após =', () => {
  const e = rodar(['5', '=', '9']);
  assert.strictEqual(Calc2.formatar(e), '9');
});

teste('formatar com separador de milhar', () => {
  assert.strictEqual(Calc2.formatar(rodar(['1', '2', '3', '4', '5'])), '12.345');
});

console.log(`\n${passou} testes passaram.`);
