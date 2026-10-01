// node tests/d67.test.js — выезд и расторжение найма
const assert = require("assert");
const { U, spec, run, allErrors, t, done, writeDocx } = require("./_load")("d67");
const base = Object.assign({}, spec.defaults, {
  contract_date: "2026-03-01", address: "г. Москва, ул. Ленина, д. 5, кв. 7", rent: 60000, deposit: 60000, long: "no",
  doc_date: "2026-10-01", ll_name: "Иванов Иван Иванович", tn_name: "Петров Пётр Петрович", ll_phone: "+7 900 111-11-11", tn_phone: "+7 900 222-22-22",
});

t("жилец: уведомление в срок, залог к возврату", () => {
  const r = run(base, { move_out: "2026-11-05" });
  assert.equal(r.d.shortDays, 0); assert.equal(r.a.hold_ok, undefined, "вопрос об удержании скрыт");
  assert(r.text.includes("УВЕДОМЛЕНИЕ") && r.text.includes("Последний день найма — 05.11.2026") && r.text.includes("не позднее 12.11.2026"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d67-notice.docx", r.a, r.d);
});

t("жилец съезжает раньше: удержание за недостающие дни", () => {
  const r = run(base, { move_out: "2026-10-21", hold_ok: "yes" });
  assert.equal(r.d.shortDays, 10); assert.equal(r.d.daily, 1972.6); assert.equal(r.d.hold, 19726);
  assert(r.text.includes("на 10 дней") && r.text.includes("19 726 (девятнадцать тысяч семьсот двадцать шесть) рублей") && r.text.includes("за вычетом 19 726 руб."));
  assert(!run(base, { move_out: "2026-10-21", hold_ok: "no" }).text.includes("удержана"));
});

t("соглашение + акт возврата: удержания и остаток к возврату", () => {
  const r = run(base, { route: "agreement", move_out: "2026-10-15", debts: [{ what: "Коммунальные услуги по счётчикам", sum: 3500 }, {}], keys: 2, m_el: 15000 });
  assert.equal(r.d.debtSum, 3500); assert.equal(r.d.toReturn, 56500);
  assert(r.text.includes("СОГЛАШЕНИЕ") && r.text.includes("АКТ ВОЗВРАТА") && r.text.includes("56 500 (пятьдесят шесть тысяч пятьсот) рублей"));
  assert(r.text.includes("электроэнергия — 15000"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d67-agreement.docx", r.a, r.d);
});

t("долг больше залога — жилец доплачивает", () => {
  const r = run(base, { route: "agreement", move_out: "2026-10-15", debts: [{ what: "Плата за наём", sum: 90000 }], keys: 2 });
  assert(r.text.includes("сверх обеспечительного платежа составляет 30 000"));
});

t("собственник: отказ по пункту договора, дата прекращения", () => {
  const r = run(base, { role: "owner", route: "refusal", notice_days: 15, grounds: "late", violation: "Плата за сентябрь не внесена", contract_clause: "6.2", debts: [{ what: "Плата за наём", sum: 60000 }] });
  assert.equal(U.fmtDate(r.d.endByRefusal), "16.10.2026");
  assert(r.text.includes("ст. 450.1") && r.text.includes("п. 6.2") && r.text.includes("прекращается 16.10.2026") && r.text.includes("полностью засчитывается в погашение") && r.text.includes("Задолженность по договору: плата за наём"));
  assert.deepEqual(allErrors(r.a), []);
});

t("собственник: предложение расторгнуть + проект соглашения; иск через 30 дней", () => {
  const r = run(base, { role: "owner", route: "claim", grounds: "damage", violation: "Разбита стеклокерамическая плита" });
  assert(r.text.includes("ПРЕДЛОЖЕНИЕ") && r.text.includes("п. 2 ст. 452") && r.text.includes("Проект") && r.text.includes("СОГЛАШЕНИЕ"));
  assert(spec.reminders(r.a, r.d).some(e => e.title.includes("иск") && U.fmtDate(e.date) === "31.10.2026"));
});

t("варианты по роли: жильцу нельзя «отказ», собственнику — «уведомление о выезде»", () => {
  const r = run(base, { role: "owner" });
  assert.equal(r.a.route, undefined, "недоступный вариант сброшен");
  assert(allErrors(Object.assign({}, base, { route: "refusal" })).includes("route"));
});

t("сроки в календарь: выезд и возврат залога", () => {
  const r = run(base, { move_out: "2026-11-05" });
  const ev = spec.reminders(r.a, r.d);
  assert(ev.some(e => U.fmtDate(e.date) === "05.11.2026") && ev.some(e => e.title.includes("залога") && U.fmtDate(e.date) === "12.11.2026"));
});

done();
