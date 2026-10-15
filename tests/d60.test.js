// node tests/d60.test.js
const assert = require("assert");
const { run, spec, U, allErrors, t, done, writeDocx } = require("./_load")("d60");
const iso = d => U.iso(d);
const today = U.today();
const ago = m => iso(U.addMonths(today, -m));
const base = Object.assign({}, spec.defaults, {
  doc_no: "ФС № 012345678", court: "Хамовнический районный суд г. Москвы", case_no: "2-1234/2026", act_date: ago(3), entry_date: ago(2), sum: 150000,
  debtor_name: "Петров Сергей Иванович", debtor_birth: "1985-02-01", debtor_address: "г. Москва, ул. Льва Толстого, д. 1, кв. 2",
  osp: "Хамовнический ОСП ГУФССП России по г. Москве",
  buyer_name: "Иванов Иван Иванович", buyer_birth: "1990-01-01", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
  bank: "АО «Т-Банк»", bik: "044525974", account: "40817810000000000001", doc_date: iso(today),
});

t("приставам: ст. 30, лист, реквизиты, ходатайства, срок предъявления", () => {
  const r = run(base, { petitions: ["requests", "arrest", "exit", "search"], debtor_info: "Ездит на Kia Rio." });
  assert(r.text.includes("о возбуждении исполнительного производства"));
  assert(r.text.includes("на основании исполнительного листа ФС № 012345678, выданного: Хамовнический районный суд г. Москвы по делу № 2-1234/2026"));
  assert(r.text.includes("денежных средств в размере 150 000 (сто пятьдесят тысяч) рублей."));
  assert(r.text.includes("№ 40817810000000000001 в АО «Т-Банк», БИК 044525974 (часть 2.2 статьи 30 Закона)"));
  assert(r.text.includes("1) направить запросы") && r.text.includes("4) при отсутствии сведений") && r.text.includes("статья 67"));
  assert(r.text.includes("Сведения о должнике, известные мне: Ездит на Kia Rio."));
  assert(r.text.includes("Подлинник: исполнительный лист."));
  const g = spec.guidance(r.a, r.d);
  assert(g[0].title.includes(U.fmtDate(U.addMonths(U.date(base.entry_date), 36))));
  assert(g.some(x => x.text.includes("12%")));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨") && !r.text.includes(".."));
  writeDocx("d60.docx", r.a, r.d);
});

t("малый долг: без запрета выезда в тексте и с подсказкой", () => {
  const r = run(base, { sum: 20000, petitions: ["exit", "search"] });
  assert(!r.text.includes("статья 67") && r.text.includes("розыск"));
  assert(spec.guidance(r.a, r.d).some(x => x.title.includes("выезд")));
});

t("банк: сведения по ч. 2 ст. 8, частичная оплата", () => {
  const r = run(base, { route: "bank", debtor_bank: "ПАО Сбербанк", debtor_bank_address: "г. Москва, ул. Вавилова, д. 19", passport: "45 12 345678, выдан 01.02.2020", paid_part: 50000 });
  assert(r.text.includes("части 1 статьи 8") && r.text.includes("гражданство: Российская Федерация;") && r.text.includes("ИНН: не присвоен;"));
  assert(r.text.includes("(с учётом частичного погашения остаток долга — 100 000 (сто тысяч) рублей)") && r.text.includes("часть 9 статьи 70"));
  assert.deepEqual(allErrors(r.a), []);
});

t("работодатель: алименты без лимита; деньги больше 100 000 — стоп", () => {
  const r = run(base, { route: "employer", what: "alimony", doc_kind: "order", alimony_text: "1/4 части всех видов заработка ежемесячно", employer: "ООО «Ромашка»", employer_address: "г. Москва", passport: "45 12 345678" });
  assert(!r.stop && r.text.includes("судебного приказа от") && r.text.includes("алиментов: 1/4 части"));
  assert(r.d.deadline === null);
  assert(run(base, { route: "employer", employer: "ООО «Ромашка»", employer_address: "г. Москва", passport: "1" }).stop.title.includes("100 000"));
  assert(run(base, { route: "bank", what: "other", other_text: "передать вещь" }).stop);
});

t("срок истёк — стоп; возврат прерывает срок; повторная подача раньше 6 месяцев", () => {
  assert(run(base, { act_date: ago(50), entry_date: ago(40) }).stop.title.includes("истёк"));
  const r = run(base, { act_date: ago(50), entry_date: ago(40), returned: "yes", return_date: ago(2), return_reason: "no_property" });
  assert(!r.stop && r.d.early);
  assert(spec.guidance(r.a, r.d).some(x => x.title.includes("6 месяцев")));
});

t("суд: выдать лист и направить приставам", () => {
  const r = run(base, { route: "court", send: "fssp" });
  assert(r.text.includes("о выдаче исполнительного листа") && r.text.includes("части 1 статьи 428") && r.text.includes("направить его для исполнения"));
  assert(!r.stop && !r.text.includes("БИК"));
  assert.deepEqual(allErrors(r.a), []);
  assert(run(base, { route: "court", send: "mail" }).text.includes("почтой по адресу: г. Москва, ул. Ленина, д. 5"));
});

t("истёк срок → кнопка ведёт на восстановление; заявление в суд", () => {
  const old = { act_date: ago(50), entry_date: ago(40) };
  const st = run(base, old).stop;
  assert.deepEqual(st.action.set, { route: "restore" });
  assert.equal(run(base, { route: "bank", what: "other", other_text: "x" }).stop.action.set.route, "fssp");
  const r = run(base, Object.assign({}, old, { route: "restore", court_kind: "general", restore_reason: "Находился на длительном лечении с 2023 по 2026 год.", restore_proof: "выписные эпикризы" }));
  assert(!r.stop, JSON.stringify(r.stop));
  assert(r.text.includes("о восстановлении пропущенного срока предъявления") && r.text.includes("статей 112 и 432 Гражданского"));
  assert(r.text.includes("по уважительной причине: Находился на длительном лечении с 2023 по 2026 год.") && r.text.includes("(3 000 ₽)") && r.text.includes(": выписные эпикризы."));
  assert(!r.text.includes("БИК") && !r.text.includes("⟨") && !r.text.includes(".."));
  assert.deepEqual(allErrors(r.a), []);
  writeDocx("d60-restore.docx", r.a, r.d);
  const arb = run(base, Object.assign({}, old, { route: "restore", court_kind: "arb", restore_reason: "x" }));
  assert(arb.text.includes("статей 117 и 322 Арбитражного") && arb.text.includes("(10 000 ₽)") && arb.text.includes("направление копии заявления должнику"));
  assert.equal(run(base, { route: "restore", court_kind: "general", restore_reason: "x" }).stop.action.set.route, "fssp");
  assert(run(base, { route: "restore", court_kind: "general", what: "alimony", alimony_text: "1/4", restore_reason: "x" }).stop.title.includes("алиментам"));
});

done();
