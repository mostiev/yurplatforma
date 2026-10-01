// node tests/d68.test.js — договор услуг/подряда B2B
const assert = require("assert");
const { U, spec, run, allErrors, t, done, writeDocx } = require("./_load")("d68");
const base = Object.assign({}, spec.defaults, {
  subject: "разработка интернет-магазина", start_date: "2026-10-05", end_date: "2026-11-30", price: 300000,
  ex_name: "Иванов Иван Иванович", ex_kind: "ip", ex_inn: "771234567890", ex_address: "г. Москва, ул. Мира, д. 1", ex_email: "ivanov@example.ru", ex_bank: "АО «Т-Банк»", ex_account: "40802810000000000001", ex_bik: "044525974",
  cl_name: "ООО «Ромашка»", cl_inn: "7701234567", cl_ogrn: "1027700000001", cl_address: "г. Москва, ул. Ленина, д. 5", cl_head_pos: "Генеральный директор", cl_head: "Петров Пётр Петрович", cl_email: "info@romashka.ru",
  city: "г. Москва", doc_date: "2026-10-01", doc_no: "12/2026",
});

t("услуги, аванс 50%: суммы прописью, НДС, без заглушек", () => {
  const r = run(base, {});
  assert(r.text.startsWith("ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ № 12/2026"));
  assert(r.text.includes("Общество") === false && r.text.includes("ООО «Ромашка» (ИНН 7701234567, ОГРН 1027700000001), именуемое в дальнейшем «Заказчик», от имени которого действует генеральный директор Петров Пётр Петрович"));
  assert(r.text.includes("индивидуальный предприниматель Иванов Иван Иванович (ИНН 771234567890), именуемый(ая) в дальнейшем «Исполнитель»"));
  assert(r.text.includes("аванс 50% — 150 000 (сто пятьдесят тысяч) рублей") && r.text.includes("НДС не облагается на основании ст. 145"));
  assert(r.text.includes("ни подписанный акт, ни мотивированный отказ не получены"));
  assert(r.text.includes("ч. 5 ст. 4 АПК") && r.text.includes("по месту нахождения ответчика"));
  assert(r.text.includes("АКТ № ___ об оказании услуг"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d68-services.docx", r.a, r.d);
});

t("подряд с перечнем: цена из таблицы, НДС 5%, права переходят, гарантия", () => {
  const r = run(base, { kind: "works", price: undefined, vat: "5", items: [{ name: "Дизайн", qty: 1, price: 105000 }, { name: "Вёрстка страниц", qty: 10, unit: "стр.", price: 10500 }] });
  assert.equal(r.d.price, 210000);
  assert(r.text.startsWith("ДОГОВОР ПОДРЯДА") && r.text.includes("«Подрядчик»") && r.text.includes("в том числе НДС 5% — 10 000 руб."));
  assert(r.text.includes("Исключительное право") && r.text.includes("Гарантийный срок на результат Работ — 6 месяцев"));
  assert(r.text.includes("ПЕРЕЧЕНЬ И СТОИМОСТЬ") && r.text.includes("2 | Вёрстка страниц | 10 | стр. | 10 500 | 105 000"));
  assert.deepEqual(allErrors(r.a), []);
  writeDocx("d68-works.docx", r.a, r.d);
});

t("ежемесячно: плата в месяц, автопродление, акты в календарь", () => {
  const r = run(base, { schedule: "monthly", monthly_fee: 50000, pay_days: 10, end_date: "2026-12-31" });
  assert(r.text.includes("50 000 (пятьдесят тысяч) рублей в месяц") && r.text.includes("продлевается на каждый следующий"));
  const ev = spec.reminders(r.a, r.d);
  assert(ev.some(e => e.title.startsWith("Акт за")) && ev.some(e => e.title.includes("продления")));
});

t("плата за отказ, ограничение ответственности, подсудность у истца", () => {
  const r = run(base, { refusal_fee: "20", court: "named", court_name: "Арбитражный суд города Москвы" });
  assert(r.text.includes("плату за отказ в размере 20%") && r.text.includes("п. 3 ст. 310") && r.text.includes("в пределах цены договора") && r.text.includes("в суд: Арбитражный суд города Москвы"));
});

t("ИНН проверяется по типу стороны", () => {
  assert(allErrors(Object.assign({}, base, { cl_inn: "771234567890" })).includes("cl_inn"));
  assert(allErrors(Object.assign({}, base, { ex_inn: "7701234567" })).includes("ex_inn"));
});

done();
