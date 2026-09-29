// node tests/d56.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d56");
const base = { what: "late", event_date: "2026-09-28", late_minutes: 35, request_date: "2026-09-29", reason: "transport",
  reason_text: "В 8:10 на станции «Выхино» остановилось движение поездов. Прибыл на работу в 9:35.", warned: "yes", warned_how: "звонок руководителю в 8:40",
  proof: "справка ГУП «Московский метрополитен» о задержке движения", position_on_guilt: "valid",
  org_name: "ООО «Ромашка»", head_position: "Генеральный директор", head_name: "Иванов Иван Иванович", buyer_name: "Петров Пётр Петрович", position: "менеджер" };

t("опоздание: факт, причина, предупредил, подтверждение, вины нет; срок 2 рабочих дня", () => {
  const r = run(base, {});
  assert(r.text.includes("28.09.2026 — опоздание на работу на 35 минут. Даю") && !r.text.includes(".."));
  assert(r.text.includes("Причина — задержка транспорта") && r.text.includes("звонок руководителю в 8:40") && r.text.includes("Копию прилагаю"));
  assert(r.text.includes("моя вина в нарушении трудовой дисциплины отсутствует"));
  const g = spec.guidance(r.a, r.d);
  assert(g[0].title.includes("до 01.10.2026"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d56.docx", r.a, r.d);
});

t("прогул: весь день — предупреждение о пп. «а» п. 6 ст. 81; частичное признание", () => {
  const r = run(base, { what: "absent", absent_full: "yes", position_on_guilt: "partly", proof: "" });
  assert(r.text.includes("отсутствие на рабочем месте в течение рабочего дня") && r.text.includes("Признаю допущенное нарушение") && !r.text.includes("Приложения"));
  assert(spec.guidance(r.a, r.d)[0].title.includes("прогул"));
  const h = run(base, { what: "absent", absent_full: "no", absent_hours: 2 });
  assert(h.text.includes("в течение 2 часов") && !spec.guidance(h.a, h.d)[0].title.includes("прогул"));
  assert(run(base, { what: "absent", absent_full: "no", absent_hours: 5 }).d.risky);
});

t("поручение и другое", () => {
  assert(run(base, { what: "task", task_desc: "подготовить отчёт до 25.09.2026" }).text.includes("невыполнение (несвоевременное выполнение) поручения: подготовить отчёт"));
  assert(run(base, { what: "other", what_other: "нарушение порядка оформления отчёта", reason: "other" }).text.includes("по факту: 28.09.2026 — нарушение порядка"));
});

done();
