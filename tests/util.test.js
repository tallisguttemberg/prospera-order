const assert = require('assert');
const U = require('../js/util.js');

let passou = 0;
function teste(nome, fn) {
  fn();
  passou++;
  console.log('  ok -', nome);
}

console.log('Testes de novos campos (CNPJ / Gramatura):');

teste('mascaraCnpj formata progressivamente', () => {
  assert.strictEqual(U.mascaraCnpj(''), '');
  assert.strictEqual(U.mascaraCnpj('12'), '12');
  assert.strictEqual(U.mascaraCnpj('12345678901234'), '12.345.678/9012-34');
});

teste('mascaraCnpj ignora não-dígitos e limita em 14', () => {
  assert.strictEqual(U.mascaraCnpj('12.345.678/9012-345678'), '12.345.678/9012-34');
});

teste('fmtCnpj formata CNPJ de 14 dígitos', () => {
  assert.strictEqual(U.fmtCnpj('12345678901234'), '12.345.678/9012-34');
});

teste('fmtCnpj mantém valor original quando incompleto ou vazio', () => {
  assert.strictEqual(U.fmtCnpj('123'), '123');
  assert.strictEqual(U.fmtCnpj(''), '');
  assert.strictEqual(U.fmtCnpj(null), '');
});

console.log(`\n${passou} testes passaram.`);
