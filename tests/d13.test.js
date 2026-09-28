// node tests/d13.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d13");
const base = {
  mode: "transfer", contract_date: "2026-10-01", address: "г. Москва, ул. Ленина, д. 5, кв. 7", act_date: "2026-10-01", keys: 2, keys_desc: "ключ, чип",
  condition: "good", m_el: 12345, m_cold: 101.5, photos: "yes",
  inventory: "Диван угловой; 1; хорошее\nХолодильник Samsung; 1; исправен, царапина на двери\nСтулья; 4; хорошее\nТелевизор; исправен",
  ll_name: "Иванов Иван Иванович", tn_name: "Петров Пётр Петрович",
};

t("опись разбирается построчно: название, количество, состояние", () => {
  const r = run(base, {});
  assert.equal(r.d.items.length, 4);
  assert.deepEqual([r.d.items[2].name, r.d.items[2].qty, r.d.items[2].cond], ["Стулья", 4, "хорошее"]);
  assert.deepEqual([r.d.items[3].qty, r.d.items[3].cond], [1, "исправен"], "без количества — 1 шт.");
  assert(r.text.includes("2. Холодильник Samsung — 1 шт. — исправен, царапина на двери"));
});

t("заселение: передаёт наймодатель, счётчики и ключи в тексте, без заглушек", () => {
  const r = run(base, {});
  assert(r.text.startsWith("Приложение № 1") && r.text.includes("Наймодатель Иванов Иван Иванович передал(а), а Наниматель Петров Пётр Петрович принял(а)"));
  assert(r.text.includes("Электроэнергия, кВт·ч: 12345") && r.text.includes("Передано комплектов ключей: 2 (ключ, чип)"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d13-transfer.docx", r.a, r.d);
});

t("недостатки перечисляются списком", () => {
  const r = run(base, { condition: "defects", defects: "Кухня — скол плитки\nВанная — трещина на раковине" });
  assert(r.text.includes("— Кухня — скол плитки\n— Ванная — трещина на раковине"));
});

t("выезд: передаёт наниматель, удержание из залога с остатком", () => {
  const r = run(base, { mode: "return", ret_damage: "yes", ret_damage_desc: "разбита столешница", deposit: 60000, deduction: 8000, deduction_reason: "замена столешницы по чеку" });
  assert(r.text.includes("Наниматель Петров Пётр Петрович передал(а)") && r.text.includes("Возврату Нанимателю подлежит 52 000"));
});

t("выезд без ущерба: залог полностью, стороны без претензий", () => {
  const r = run(base, { mode: "return", ret_damage: "no", deposit: 60000, deduction: 0 });
  assert(r.text.includes("в полном объёме") && r.text.includes("претензий друг к другу"));
});

t("удержание больше залога — ошибка", () => {
  assert(allErrors(run(base, { mode: "return", ret_damage: "no", deposit: 1000, deduction: 5000 }).a).includes("deduction"));
});

done();
