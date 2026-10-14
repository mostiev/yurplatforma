// node tests/d79.test.js — решение единственного участника ООО
const assert = require("assert");
const { U, spec, run, allErrors, t, done, writeDocx } = require("./_load")("d79");
const base = Object.assign({}, spec.defaults, {
  dir_name: "Иванов Иван Иванович", dir_pos: "Генеральный директор", dir_from: "2026-10-15",
  org_name: "Общество с ограниченной ответственностью «Ромашка»", org_inn: "7701234567", org_ogrn: "1027700000001", org_address: "г. Москва", owner: "Иванов Иван Иванович", owner_passport: "45 12 345678", city: "г. Москва", doc_date: "2026-10-01",
});
t("продление полномочий: нотариус, срок, без Р13014", () => {
  const r = run(base, {});
  assert(r.text.includes("Продлить полномочия") && r.text.includes("сроком на 5 лет") && r.text.includes("удостоверению нотариусом"));
  assert(spec.guidance(r.a, r.d)[0].title.includes("нотариуса"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d79.docx", r.a, r.d);
});
t("дивиденды и отчётность: 60 дней, условия ст. 29, НДФЛ; способ из устава", () => {
  const r = run(base, { kinds: ["annual", "dividends"], annual_year: "2025", period: "year", period_text: "2025 год", div_sum: 3000000, charter_method: "yes" });
  assert(r.text.includes("за 2025 год год") === false && r.text.includes("Утвердить годовую") && r.text.includes("не позднее 30.11.2026") && r.text.includes("ст. 29 Закона") && r.text.includes("ст. 67.1"));
  assert.equal(r.d.tax, 402000);
  assert(!r.text.includes("удостоверению нотариусом"));
});
done();
