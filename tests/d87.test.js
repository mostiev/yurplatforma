// node tests/d87.test.js
const assert = require("assert");
const { run, spec, U, allErrors, t, done, writeDocx } = require("./_load")("d87");
const iso = d => U.iso(d);
const base = Object.assign({}, spec.defaults, {
  mil_name: "Петров Сергей Иванович", service_start: "2022-10-01", bank: "ПАО «Банк»", loan_no: "625/0000-0012345", loan_date: "2021-05-15",
  buyer_address: "г. Москва, ул. Мира, д. 1", buyer_phone: "+7 900 000-00-00", doc_date: iso(U.today()),
});

t("каникулы: мобилизованный, свой кредит — проценты не платятся, 10/15 дней", () => {
  const r = run(base, { start_date: "2022-10-01" });
  assert(r.text.includes("о предоставлении льготного периода") && r.text.includes("призван на военную службу по мобилизации с 01.10.2022"));
  assert(r.text.includes("льготный период по кредитному договору № 625/0000-0012345 от 15.05.2021"));
  assert(r.text.includes("с 01.10.2022 на срок мобилизации, увеличенный на 180 дней"));
  assert(r.text.includes("уплате не подлежат (часть 18.1") && r.text.includes("в течение 15 дней"));
  assert(!r.stop); assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨") && !r.text.includes(".."));
  assert(spec.reminders(r.a, r.d).length === 1);
  writeDocx("d87.docx", r.a, r.d);
});

t("каникулы: член семьи по своему кредиту — 2/3 ПСК и документы о родстве", () => {
  const r = run(base, { who: "family", relation: "spouse", borrower: "own", buyer_name: "Петрова Анна Петровна" });
  assert(r.text.includes("Я являюсь членом семьи военнослужащего: супруга.") && r.text.includes("двум третям") && r.text.includes("свидетельства о заключении брака"));
  assert(r.text.includes("От: Петрова Анна Петровна"));
  assert.deepEqual(allErrors(r.a), []);
});

t("каникулы: ипотека — без ставки; кредит после мобилизации — мягко; дата раньше 21.09.2022 — ошибка", () => {
  const m = run(base, { loan_type: "mortgage" });
  assert(!m.text.includes("18.1") && !m.text.includes("двум третям"));
  assert(run(base, { loan_date: "2023-01-10" }).stop.soft);
  assert(allErrors(run(base, { start_date: "2022-09-01" }).a).includes("start_date"));
  assert(spec.steps[2].questions.find(q => q.id === "start_date").validate("2022-09-01", base).includes("21.09.2022"));
  const rel = spec.steps[0].questions.find(q => q.id === "relation").options.find(o => o.value === "parent");
  assert(rel.disabled({ kind: "holiday" }) && !rel.disabled({ kind: "end" }));
});

t("прекращение долга при гибели: наследник, ипотека — снять обременение", () => {
  const r = run(base, { kind: "end", who: "heir", relation: "child", buyer_name: "Петров Иван Сергеевич", death_kind: "died", event_date: "2026-06-01", event_doc: "V-МЮ № 123456", loan_type: "mortgage" });
  assert(r.text.includes("о прекращении обязательств по кредитному договору") && r.text.includes("части 1 статьи 2") && r.text.includes("24 февраля 2022"));
  assert(r.text.includes("снять обременение") && r.text.includes("наследственного дела"));
  assert(!r.stop); assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d87-end.docx", r.a, r.d);
  assert(run(base, { kind: "end", death_kind: "disability", event_date: "2026-03-01", loan_type: "nis" }).stop.soft);
  assert(run(base, { kind: "end", who: "family", relation: "spouse", buyer_name: "Х", borrower: "guarantee", death_kind: "died", event_date: "2026-06-01" }).text.includes("части 1.2 статьи 2"));
});

t("списание до 10 млн: волны 2026 и 2024, приставам — второй лист, отсечки", () => {
  const w = { kind: "w21", contract_date: "2026-06-10", court_kind: "court", court_date: "2025-11-01", court_info: "дело № 2-555/2025", osp: "Октябрьский РОСП г. Уфы", debt: 300000 };
  const r = run(base, w);
  assert.equal(r.d.wave, "2026");
  assert(r.text.includes("до 01.05.2026 вступил в законную силу судебный акт") && r.text.includes("10 миллионов рублей"));
  assert(r.text.includes("о прекращении исполнительного производства") && r.text.includes("В Октябрьский РОСП г. Уфы"));
  assert(!r.stop); assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d87-w21.docx", r.a, r.d);
  const old = run(base, Object.assign({}, w, { contract_date: "2025-03-01", court_date: "2024-06-01" }));
  assert.equal(old.d.wave, "2024"); assert(old.text.includes("в редакции, действовавшей на дату заключения контракта") && !old.stop);
  assert(run(base, Object.assign({}, w, { court_date: "2026-06-01" })).stop.action.set.kind === "holiday");
  assert(run(base, Object.assign({}, w, { contract_date: "2024-01-10" })).stop.link.href === "d88.html");
  assert(run(base, Object.assign({}, w, { term_year: "no" })).stop);
  assert(run(base, Object.assign({}, w, { debt: 12000000 })).stop.soft);
});

done();
