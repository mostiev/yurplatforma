// node tests/d90.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d90");
const recent = U.iso(U.addDays(U.today(), -10));
const base = {
  court_kind: "district", court: "Хамовнический районный суд г. Москвы", court_address: "г. Москва, ул. Ефремова, д. 7", appeal_court: "Московский городской суд",
  case_no: "2-1234/2026", decision_date: recent, final_date: recent, decision: "Взыскал с меня в пользу ООО «Ромашка» 184 300 руб.",
  role: "defendant", others: [{ name: "ООО «Ромашка»", role: "истец", address: "г. Москва, ул. Тверская, д. 1" }],
  grounds: ["law", "limitation"], args: "Последний платёж был 10.01.2021, иск подан 15.05.2026.",
  ask: "cancel_new", ask_text: "в удовлетворении иска ООО «Ромашка» отказать полностью", new_evidence: "no", fee_exempt: "none",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("в срок: шапка «через» суд первой инстанции, основания ст. 330, просьба по ст. 328, пошлина и копии", () => {
  const r = run(base, {});
  assert(r.text.startsWith("В Московский городской суд\nчерез Хамовнический районный суд г. Москвы"));
  assert(r.text.includes("Ответчик: Петров Пётр Петрович") && r.text.includes("Истец: ООО «Ромашка»\nАдрес: г. Москва, ул. Тверская"));
  assert(r.text.includes("Государственная пошлина: 3 000 руб.") && r.text.includes("АПЕЛЛЯЦИОННАЯ ЖАЛОБА"));
  assert(r.text.includes("п. 4 ч. 1 ст. 330 ГПК РФ") && r.text.includes("ст. 199 ГК РФ"));
  assert(r.text.includes("1. Отменить решение полностью и принять по делу новое решение: в удовлетворении иска ООО «Ромашка» отказать полностью."));
  assert(r.text.includes("направление копии жалобы ООО «Ромашка» (ч. 4 ст. 322") && r.text.includes("Документ об уплате государственной пошлины"));
  assert(!r.text.includes("ХОДАТАЙСТВО") && !r.d.late);
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
  writeDocx("d90.docx", r.a, r.d);
});

t("срок — месяц по ст. 108: 31.08 → 30.09 (в сентябре нет 31-го); 01.10 → 01.11.2026 (вс) → 02.11", () => {
  assert.equal(U.fmtDate(run(base, { final_date: "2026-08-31" }).d.deadline), "30.09.2026");
  assert.equal(U.fmtDate(run(base, { final_date: "2026-09-30" }).d.deadline), "30.10.2026");
  assert.equal(U.fmtDate(run(base, { final_date: "2026-10-01" }).d.deadline), "02.11.2026");
});

t("срок прошёл: шаг «Срок», ходатайство на отдельной странице, п. 20 Пленума № 16, просьба восстановить", () => {
  const r = run(base, { final_date: "2026-08-03", decision_date: "2026-07-28", late_reason: "copy_late", late_date: "2026-10-20" });
  assert(r.d.late && r.text.includes("1. Восстановить срок на подачу апелляционной жалобы") && r.text.includes("2. Отменить решение полностью"));
  assert(r.text.includes("ХОДАТАЙСТВО") && r.text.includes("копию мотивированного решения я получил(а) только 20.10.2026") && r.text.includes("п. 20 постановления Пленума"));
  assert(r.text.includes("Ходатайство о восстановлении срока."));
  assert.deepEqual(allErrors(r.a), []);
  writeDocx("d90-late.docx", r.a, r.d);
});

t("потребитель освобождён от пошлины — нет квитанции, есть основание", () => {
  const r = run(base, { role: "plaintiff", fee_exempt: "consumer", ask: "cancel_partly", ask_text: "взыскать штраф 50% по п. 6 ст. 13 ЗоЗПП" });
  assert(r.text.includes("не уплачивается (ст. 333.36 НК РФ)") && r.text.includes("пп. 4 п. 2 ст. 333.36") && !r.text.includes("Документ об уплате"));
  assert(r.text.startsWith("В Московский") && r.text.includes("Истец: Петров"));
});

t("мировой судья без мотивированного решения — мягкий стоп; не извещён → ч. 5 ст. 330; новые доказательства", () => {
  const r = run(base, { court_kind: "mirovoy", motivated: "no", grounds: ["notice"], new_evidence: "yes", evidence_list: "Справка банка о погашении", evidence_why: "не был(а) извещён(а) о заседании" });
  assert(r.stop && r.stop.soft && r.stop.title.includes("мотивированное"));
  assert(r.text.includes("на решение мирового судьи") && r.text.includes("ч. 5 ст. 330") && r.text.includes("абз. 2 ч. 1 ст. 327.1") && r.text.includes("Справка банка о погашении."));
});

t("лицо, не привлечённое к делу, — обоснование по ч. 3 ст. 320; без него ошибка", () => {
  assert(allErrors(run(base, { role: "outsider" }).a).includes("outsider_why"));
  assert(run(base, { role: "outsider", outsider_why: "суд разделил квартиру, где у меня 1/3 доли" }).text.includes("ч. 3 ст. 320 ГПК РФ"));
});

t("напоминание о последнем дне", () => {
  const r = run(base, {}); const rem = spec.reminders(r.a, r.d);
  assert(rem.length === 1 && rem[0].date.getTime() === r.d.deadline.getTime());
});

done();
