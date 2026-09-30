// node tests/d64.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d64");
const base = Object.assign({}, spec.defaults, {
  last_day: "2026-10-30", pay_amount: 150000, org_name: "ООО «Ромашка»", head_position: "Генеральный директор", head_name: "Иванов Иван Иванович",
  buyer_name: "Петрова Анна Сергеевна", position: "Менеджер по продажам", contract_no: "15/22", contract_date: "2022-03-01", city: "г. Москва", doc_date: "2026-10-01",
});

t("соглашение: основание, дата, расчёт, выходное пособие", () => {
  const r = run(base, { extra: "Работник передаёт дела до 29.10.2026" });
  assert(r.text.includes("о расторжении трудового договора от 01.03.2022 № 15/22"));
  assert(r.text.includes("пункта 1 части первой статьи 77 и статьи 78"));
  assert(r.text.includes("2. Последний день работы Работника (день прекращения трудового договора) — 30.10.2026."));
  assert(r.text.includes("4. Помимо выплат, указанных в пункте 3, Работодатель выплачивает Работнику выходное пособие в размере 150 000 (сто пятьдесят тысяч) рублей в день увольнения"));
  assert(r.text.includes("5. Работник передаёт дела до 29.10.2026.") && r.text.includes("6. Настоящее соглашение может быть изменено или отменено только по взаимному согласию"));
  assert(r.text.includes("1 октября 2026 г."));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d64.docx", r.a, r.d);
});

t("без выплаты и с датой выплаты", () => {
  const r = run(base, { payment: "no" });
  assert(!r.text.includes("выходное пособие") && r.text.includes("4. Настоящее соглашение"));
  const p = run(base, { pay_when: "date", pay_date: "2026-11-10" });
  assert(p.text.includes("не позднее 10.11.2026"));
});

t("предложение + проект", () => {
  const r = run(base, { route: "proposal" });
  assert(r.text.includes("ПРЕДЛОЖЕНИЕ") && r.text.includes("Проект соглашения прилагаю") && r.text.includes("Проект") && r.text.includes("«___» __________ 20__ г."));
});

t("госкомпания с выплатой — стоп; даты наоборот — стоп", () => {
  assert(run(base, { state_co: "yes" }).stop.text.includes("ст. 349.3"));
  assert(!run(base, { state_co: "yes", payment: "no" }).stop);
  assert(run(base, { last_day: "2026-09-01" }).stop);
});

done();
