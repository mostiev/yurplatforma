// node tests/d73.test.js — акт сверки
const assert = require("assert");
const { spec, run, allErrors, t, done, writeDocx } = require("./_load")("d73");
const base = Object.assign({}, spec.defaults, {
  contract: "договору поставки № 12/2026 от 01.03.2026", from: "2026-07-01", to: "2026-09-30", open_sum: 50000, open_side: "us", doc_date: "2026-10-01",
  ops: [{ date: "2026-08-01", doc: "УПД № 15", deb: 200000 }, { date: "2026-07-10", doc: "п/п № 340", cred: 50000 }, { date: "2026-09-15", doc: "п/п № 401", cred: 120000 }],
  us_name: "ООО «Поставка»", us_inn: "7701234567", us_address: "г. Москва", us_head_pos: "Директор", us_head: "Сидоров Сидор Сидорович",
  th_name: "ООО «Кофейня»", th_inn: "7707654321", th_address: "г. Москва", th_head_pos: "Генеральный директор", th_head: "Петров Пётр Петрович",
});
t("сальдо: 50 000 + 200 000 − 170 000 = 80 000 в нашу пользу, операции по датам, признание", () => {
  const r = run(base, {});
  assert.equal(r.d.close, 80000);
  assert.equal(r.d.ops[0].doc, "п/п № 340", "сортировка по дате");
  assert(r.text.includes("Сальдо на конец периода | 80 000") && r.text.includes("в пользу ООО «Поставка» составляет 80 000 (восемьдесят тысяч) рублей") && r.text.includes("ООО «Кофейня» признаёт"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d73.docx", r.a, r.d);
});
t("долг в пользу контрагента и нулевое сальдо", () => {
  assert(run(base, { open_side: "them", open_sum: 200000 }).text.includes("в пользу ООО «Кофейня»"));
  assert(run(base, { open_sum: undefined, ops: [{ date: "2026-08-01", doc: "УПД", deb: 1000 }, { date: "2026-08-02", doc: "п/п", cred: 1000 }] }).text.includes("задолженность между сторонами отсутствует"));
});
done();
