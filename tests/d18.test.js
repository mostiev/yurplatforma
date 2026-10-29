// node tests/d18.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d18");
const base = { developer: "ООО «СЗ Новый дом»", developer_address: "г. Москва, ул. Тверская, д. 1", ddu: "№ ДДУ-123/45 от 10.03.2023", object: "кв. № 45", price: 10000000,
  due_date: "2023-12-31", handed: "yes", handed_date: "2026-03-01", extension: "no", refund: "requisites", buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00" };

t("срок 31.12.2023 (ставка 16%): до 21.03.2024 — 7,5%, 22.03.2024–31.12.2025 — мораторий, с 01.01.2026 — 16%", () => {
  const r = run(base, {});
  const c = r.d.calc;
  assert.equal(c.base, 16);
  assert.deepEqual(c.parts.map(p => [U.fmtDate(p.from), U.fmtDate(p.to), p.days, p.rate]), [["01.01.2024", "21.03.2024", 81, 7.5], ["22.03.2024", "31.12.2025", 650, 0], ["01.01.2026", "01.03.2026", 60, 16]]);
  const manual = 10000000 * 7.5 / 100 / 300 * 2 * 81 + 10000000 * 16 / 100 / 300 * 2 * 60;
  assert.equal(c.total, Math.round(manual * 100) / 100);
  assert(r.text.includes("127-КГ23-18-К4") && r.text.includes("мораторий, неустойка не начисляется") && r.text.includes("штрафа в размере 5%"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d18.docx", r.a, r.d);
});

t("срок в 2021 году (ставка 6,75% на 30.09.2021): мораторий 2022–2023 и потолок 7,5% не выше базовой", () => {
  const c = run(base, { due_date: "2021-09-30", handed_date: "2022-06-30" }).d.calc;
  assert.equal(c.base, 6.75);
  assert.deepEqual(c.parts.map(p => p.rate), [6.75, 0]);
  assert.equal(c.parts[0].days, U.daysBetween(U.date("2021-09-30"), U.date("2022-03-28")));
});

t("не передана — считаем по сегодня и требуем за последующие дни; нет просрочки — стоп", () => {
  const r = run(base, { handed: "no", due_date: "2026-06-30" });
  assert(r.text.includes("До настоящего времени объект не передан") && r.text.includes("по день фактической передачи") && r.d.calc.parts.every(p => p.rate === C_rate(r)));
  assert(run(base, { due_date: "2026-06-30", handed_date: "2026-06-15" }).stop);
  function C_rate(r) { return r.d.calc.base; }
});

t("отсрочка до 31.12.2026 — только для требований до 01.01.2026 (проверка 30.10.2026)", () => {
  const r = run(base, {});
  const g = spec.guidance(r.a, r.d).find(x => x.title.includes("31.12.2026"));
  assert(g && g.text.includes("до 01.01.2026"));
});

done();
