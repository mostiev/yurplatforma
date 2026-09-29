// node tests/d57.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d57");
const job = { org_name: "ООО «Ромашка»", head_position: "Генеральный директор", head_name: "Иванов Иван Иванович", buyer_name: "Петров Пётр Петрович", position: "менеджер" };
const base = Object.assign({ kind: "annual", schedule: "yes", start_date: "2026-10-26", days: 14, hired_date: "2025-03-01", filed_date: "2026-10-05" }, job);

t("ежегодный по графику: 14 дней с 26.10, 4 ноября не входит → по 09.11", () => {
  const r = run(base, {});
  assert(r.text.includes("ежегодный основной оплачиваемый отпуск продолжительностью 14 календарных дней с 26.10.2026 по 09.11.2026 в соответствии с графиком"));
  assert(r.text.includes("нерабочие праздничные дни (1)") && r.text.includes("статьи 120"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d57.docx", r.a, r.d);
});

t("без праздников — ровно N дней; вне графика многодетному — ст. 262.2; меньше 14 дней — подсказка; первый год", () => {
  const r = run(base, { start_date: "2026-08-03", days: 7, schedule: "no", priority: "many_kids", hired_date: "2026-05-01" });
  assert(r.text.includes("7 календарных дней с 03.08.2026 по 09.08.2026") && r.text.includes("статья 262.2") && !r.text.includes("праздничные"));
  const g = spec.guidance(r.a, r.d);
  assert(g.some(x => x.title.includes("14 дней")) && g.some(x => x.title.includes("01.11.2026")));
});

t("за свой счёт: пенсионеру до 14 дней, больше — стоп; события — 5 дней; праздники считаются", () => {
  const r = run(base, { kind: "unpaid", unpaid_reason: "event", start_date: "2026-11-02", days: 5 });
  assert(r.text.includes("без сохранения заработной платы продолжительностью 5 календарных дней с 02.11.2026 по 06.11.2026 в связи с рождением"));
  assert(run(base, { kind: "unpaid", unpaid_reason: "pensioner", days: 20 }).stop.title.includes("14"));
  assert(!run(base, { kind: "unpaid", unpaid_reason: "agreement", days: 20 }).stop);
});

t("с последующим увольнением и перенос", () => {
  const r = run(base, { kind: "dismissal", start_date: "2026-10-12", days: 28 });
  assert(r.text.includes("с последующим увольнением") && r.text.includes("последний день отпуска — 09.11.2026") && r.text.includes("окончательный расчёт"));
  const m = run(base, { kind: "move", old_start: "2026-10-12", move_reason: "notpaid", start_date: "2026-11-16", days: 14 });
  assert(m.text.includes("отпускные не были выплачены") && m.text.includes("с 16.11.2026 по 29.11.2026"));
});

done();
