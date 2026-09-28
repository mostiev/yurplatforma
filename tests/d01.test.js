// Прогон сценариев Д-01 без браузера: node tests/d01.test.js
// Проверяет ветки, недоступные требования, стоп-ситуации и сборку .docx.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ctx = { globalThis: null, TextEncoder, console, Date };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["assets/docx.js", "assets/engine.js", "content/d01.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const { Engine, DOCS, Docx } = ctx;
const spec = DOCS.d01;
const U = Engine.U;
const ago = n => U.iso(U.addDays(U.today(), -n));
const monthsAgo = n => U.iso(U.addMonths(U.today(), -n));

const base = {
  channel: "store", product: "Смартфон Samsung Galaxy A55", category: "phone",
  received_date: ago(40), price: 32990, proof: "receipt", warranty: "yes", warranty_months: 12,
  defect: "не заряжается", defect_date: ago(3), prior_refusal: "no",
  seller_name: "ООО «Ромашка»", seller_inn: "7701234567", seller_address: "г. Москва, ул. Тверская, д. 1",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5, кв. 7", buyer_phone: "+7 900 000-00-00",
};
const run = over => { const a = Object.assign({}, base, over); Engine.prune(spec, a); const d = spec.derive(a); return { a, d, text: Engine.paragraphsToText(spec.render(a, d)), stop: spec.stop(a, d) }; };
const demandQ = spec.steps[2].questions.find(q => q.id === "demand");
const disabled = (a, d, v) => !!demandQ.options.find(o => o.value === v).disabled(a, d);
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok —", name); };

t("смартфон, 40 дней, без повторных ремонтов: возврат и замена недоступны, ремонт доступен", () => {
  const { a, d } = run({ repairs: "none" });
  assert(d.techRestricted);
  assert(disabled(a, d, "refund") && disabled(a, d, "replace_same") && disabled(a, d, "replace_other"));
  assert(!disabled(a, d, "repair") && !disabled(a, d, "price_cut") && !disabled(a, d, "repair_costs"));
});

t("смартфон, 10 дней: возврат доступен", () => {
  const { a, d } = run({ received_date: ago(10), defect_date: ago(2) });
  assert(!d.techRestricted && !disabled(a, d, "refund"));
});

t("смартфон после 15 дней с повторным недостатком: возврат доступен и основание в тексте", () => {
  const { a, d, text } = run({ repairs: "many", repair_overdue: "no", demand: "refund", refund_method: "card" });
  assert(!disabled(a, d, "refund"));
  assert(text.includes("Товар относится к технически сложным"));
  assert(text.includes("существенным"));
});

t("просрочка ремонта открывает замену", () => {
  const { a, d } = run({ repairs: "once", repair_overdue: "yes" });
  assert(!disabled(a, d, "replace_same"));
});

t("больше 30 дней ремонта за год открывает возврат", () => {
  const { a, d } = run({ repairs: "once", repair_overdue: "no", repair_days: 34 });
  assert(!disabled(a, d, "refund"));
});

t("одежда через 40 дней: возврат доступен (не техсложный)", () => {
  const { a, d } = run({ category: "clothes" });
  assert(!d.techRestricted && !disabled(a, d, "refund"));
});

t("выбранный недоступный вариант стирается при смене категории", () => {
  const a = Object.assign({}, base, { category: "clothes", demand: "refund", refund_method: "cash" });
  Engine.prune(spec, a); assert.equal(a.demand, "refund");
  a.category = "phone"; Engine.prune(spec, a);
  assert.equal(a.demand, undefined); assert.equal(a.refund_method, undefined);
});

t("ответ на сумму не стирается, хотя у вопроса два варианта формулировки", () => {
  const a = Object.assign({}, base, { demand: "price_cut", amount: 5000, refund_method: "card" });
  Engine.prune(spec, a); assert.equal(a.amount, 5000);
});

t("маркетплейс и частное лицо — стоп", () => {
  assert(run({ channel: "marketplace" }).stop); assert(run({ channel: "private" }).stop);
});

t("недостаток через 2,5 года без гарантии — стоп; с гарантией 3 года — нет", () => {
  assert(run({ received_date: monthsAgo(31), defect_date: ago(5), warranty: "no" }).stop);
  assert(!run({ received_date: monthsAgo(31), defect_date: ago(5), warranty: "yes", warranty_months: 36 }).stop);
});

t("недостаток в гарантию — фраза про бремя доказывания; вне гарантии — нет", () => {
  assert(run({ category: "clothes", demand: "refund", refund_method: "card" }).text.includes("лежит на вас"));
  assert(!run({ category: "clothes", warranty: "no", demand: "refund", refund_method: "card" }).text.includes("лежит на вас"));
});

t("чека нет — ссылка на п. 5 ст. 18, в приложениях нет копии чека", () => {
  const { text } = run({ category: "clothes", proof: "none", demand: "refund", refund_method: "cash" });
  assert(text.includes("п. 5 ст. 18")); assert(!text.includes("Копия кассового"));
});

t("сроки везде «со дня предъявления», нет «со дня получения»", () => {
  for (const dem of ["refund", "price_cut", "repair_costs", "replace_same"]) {
    const { text } = run({ category: "clothes", demand: dem, amount: 1000, refund_method: "card" });
    assert(!text.includes("со дня получения"), dem);
  }
});

t("подменный товар: для смартфона вопрос есть, для мебели нет", () => {
  const loanerQ = spec.steps[2].questions.find(q => q.id === "loaner");
  const p = run({ demand: "repair" }); assert(loanerQ.show(p.a, p.d));
  const f = run({ category: "furniture", demand: "repair" }); assert(!loanerQ.show(f.a, f.d));
});

t("полный документ без заглушек и валидный .docx", () => {
  const { a, d, text } = run({ category: "clothes", demand: "refund", refund_method: "card" });
  assert(!text.includes("⟨"), "остались незаполненные места");
  for (const step of spec.steps) assert.deepEqual(Object.keys(Engine.stepErrors(spec, step, a)), [], step.id);
  const bytes = Docx.buildDocx(spec.render(a, d));
  fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "out", "d01-refund.docx"), bytes);
  const r = run({ repairs: "many", repair_overdue: "yes", demand: "refund", refund_method: "requisites", prior_refusal: "written" });
  fs.writeFileSync(path.join(__dirname, "out", "d01-tech.docx"), Docx.buildDocx(spec.render(r.a, r.d)));
});

console.log(`\n${n} проверок пройдено`);
