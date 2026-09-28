// node tests/d04.test.js
const assert = require("assert");
const { U, run, allErrors, t, done, writeDocx, spec } = require("./_load")("d04");
const ago = n => U.iso(U.addDays(U.today(), -n));
const monthsAgo = n => U.iso(U.addMonths(U.today(), -n));
const base = {
  kind: "repair", executor_type: "company", service_desc: "Замена экрана iPhone 13", contract_date: ago(30), contract_doc: "receipt",
  price: 15000, accepted_date: ago(28), warranty: "yes", warranty_months: 3, defect: "не работает сенсор", defect_date: ago(2),
  fix_failed: "no", essential: "no", demand: "fix", fix_days: 14,
  executor_name: "ООО «Сервис»", executor_address: "г. Москва, ул. Садовая, д. 3",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};
const refundQ = spec.steps[2].questions.find(q => q.id === "demand").options.find(o => o.value === "refund");

t("отказ от договора закрыт, пока недостаток не существенный и срок исправления не нарушен", () => {
  const r = run(base, {}); assert(refundQ.disabled(r.a, r.d));
  const r2 = run(base, { essential: "yes" }); assert(!refundQ.disabled(r2.a, r2.d));
  const r3 = run(base, { fix_failed: "yes", fix_request_date: ago(20) }); assert(!refundQ.disabled(r3.a, r3.d));
});

t("выбранный отказ стирается, если условия пропали", () => {
  const a = Object.assign({}, base, { essential: "yes", demand: "refund", refund_method: "card" });
  const { Engine } = require("./_load")("d04");
  a.essential = "no"; Engine.prune(require("./_load")("d04").spec, a);
  assert.equal(a.demand, undefined);
});

t("исправление: срок назначает потребитель, ст. 30", () => {
  const r = run(base, {}); assert(r.text.includes("в течение 14 дней") && r.text.includes("ст. 30"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
});

t("деньги — 10 дней по п. 1 ст. 31; переделка — п. 2 ст. 31", () => {
  assert(run(base, { demand: "price_cut", amount: 5000, refund_method: "card" }).text.includes("10 дней"));
  assert(run(base, { demand: "redo" }).text.includes("п. 2 ст. 31"));
});

t("неустойка 3% со ссылкой на п. 5 ст. 28", () => {
  const txt = run(base, {}).text; assert(txt.includes("3%") && txt.includes("п. 5 ст. 28"));
});

t("гарантия: бремя доказывания на исполнителе; без гарантии — нет", () => {
  assert(run(base, {}).text.includes("п. 4 ст. 29"));
  assert(!run(base, { warranty: "no" }).text.includes("п. 4 ст. 29"));
});

t("сроки: 2 года для вещей, 5 лет для ремонта квартиры", () => {
  assert(run(base, { warranty: "no", accepted_date: monthsAgo(30), contract_date: monthsAgo(31), defect_date: ago(3) }).stop);
  assert(!run(base, { kind: "flat", warranty: "no", accepted_date: monthsAgo(30), contract_date: monthsAgo(31), defect_date: ago(3) }).stop);
  assert(run(base, { kind: "flat", warranty: "no", accepted_date: monthsAgo(62), contract_date: monthsAgo(63), defect_date: ago(3) }).stop);
});

t("медицина, обучение, частный мастер — стоп с подсказкой", () => {
  assert(run(base, { kind: "medical" }).stop); assert(run(base, { kind: "education" }).stop); assert(run(base, { executor_type: "person" }).stop);
});

t("отказ с убытками — сумма убытков в тексте", () => {
  const r = run(base, { essential: "yes", demand: "refund", refund_method: "cash", losses: 2000 });
  assert(r.text.includes("15 000") && r.text.includes("2 000") && r.text.includes("существенными"));
  writeDocx("d04-refund.docx", r.a, r.d);
});

done();
