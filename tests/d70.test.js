// node tests/d70.test.js — аренда нежилого помещения
const assert = require("assert");
const { U, spec, run, allErrors, t, done, writeDocx } = require("./_load")("d70");
const base = Object.assign({}, spec.defaults, {
  address: "г. Москва, ул. Ленина, д. 5, пом. II", area: 45, ownership_doc: "Выписка из ЕГРН от 10.09.2026", purpose: "офис", condition: "ready",
  start_date: "2026-10-05", rent: 120000, signage: "no",
  ll_name: "ООО «Недвижимость»", ll_inn: "7701234567", ll_address: "г. Москва, ул. Мира, д. 1", ll_head_pos: "Директор", ll_head: "Сидоров Сидор Сидорович",
  tn_name: "Иванов Иван Иванович", tn_kind: "ip", tn_inn: "771234567890", tn_address: "г. Москва, ул. Садовая, д. 2",
  city: "г. Москва", doc_date: "2026-10-01",
});

t("11 месяцев: без регистрации, автопродление, залог 1 месяц, плата за отказ", () => {
  const r = run(base, {});
  assert(!r.d.reg && r.text.includes("считается заключённым на тот же срок") && r.text.includes("ст. 621"));
  assert(r.text.includes("обеспечительный платёж 120 000 (сто двадцать тысяч) рублей") && r.text.includes("платой за отказ от договора (п. 3 ст. 310"));
  assert(r.text.includes("Переменная часть арендной платы") && r.text.includes("ст. 450.1") && r.text.includes("АКТ ПРИЁМА-ПЕРЕДАЧИ НЕЖИЛОГО"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d70.docx", r.a, r.d);
});

t("2 года: регистрация, индексация, каникулы", () => {
  const r = run(base, { term_months: 24, index: "pct", index_pct: 7, condition: "repair", holidays: 30 });
  assert(r.d.reg && r.text.includes("п. 2 ст. 651") && r.text.includes("не более чем на 7%") && r.text.includes("начисляется с 04.11.2026"));
  assert(spec.reminders(r.a, r.d).some(e => e.title.includes("Росреестр")));
});

t("арендодатель — физлицо: НДФЛ удерживает арендатор, паспорт в преамбуле", () => {
  const r = run(base, { ll_kind: "person", ll_name: "Петров Пётр Петрович", ll_passport: "45 12 345678", ll_inn: undefined, ll_head_pos: undefined, ll_head: undefined });
  assert(r.text.includes("Петров Пётр Петрович, паспорт 45 12 345678") && r.text.includes("ст. 226 НК"));
  assert.deepEqual(allErrors(r.a), []);
});

done();
