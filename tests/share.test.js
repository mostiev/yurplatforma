// node tests/share.test.js — черновик в ссылке: упаковка и распаковка без потерь
const assert = require("assert");
const { U, t, done } = require("./_load")("d12");
t("ответы с кириллицей, массивами и таблицами переживают ссылку", () => {
  const a = { address: "г. Москва, ул. Ленина, д. 5, кв. 7 «Ёлка»", rent: 50000, pets: "yes", co_owners: [{ name: "Иванова Анна", share: "1/2" }], multi: ["a", "b"] };
  const s = U.packAnswers(a);
  assert(/^[A-Za-z0-9_-]+$/.test(s));
  assert.deepEqual(U.unpackAnswers(s), a);
});
t("мусор в ссылке — без ошибки", () => { assert.equal(U.unpackAnswers("%%%"), null); assert.equal(U.unpackAnswers(U.packAnswers([1, 2])), null); });
done();
