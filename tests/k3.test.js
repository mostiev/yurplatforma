// node tests/k3.test.js
const assert = require("assert");
const { U, C, run, val, t, done } = require("./_loadcalc")("k3");
const m = n => U.money(n).replace(/ /g, " ") + " ₽";

t("мораторий 2022: 01.04–01.10.2022 не начисляем", () => {
  const r = run({ amount: 100000, due_date: "2022-02-28", paid: "yes", paid_date: "2022-12-31" });
  assert.deepEqual(r.table.rows.map(x => [x[0], x[3]]), [["01.03.2022–31.03.2022", "20% / 365"], ["01.04.2022–01.10.2022", "мораторий"], ["02.10.2022–31.12.2022", "7,5% / 365"]]);
  assert.equal(r.summary.find(s => s.big).value, m(Math.round((100000 * 20 / 100 / 365 * 31 + 100000 * 7.5 / 100 / 365 * 91) * 100) / 100));
  assert(r.notes.some(n => n.includes("ПП № 497")) && r.notes.some(n => n.includes("исковой давности")));
  const off = run({ amount: 100000, due_date: "2022-02-28", paid: "yes", paid_date: "2022-12-31", moratorium: "no" });
  assert(!off.table.rows.some(x => x[3] === "мораторий"));
});

t("частичная оплата уменьшает долг со следующего дня; совпадает с C.comp395", () => {
  const a = { amount: 100000, due_date: "2026-01-30", partial: "02.03.2026; 30000", paid: "yes", paid_date: "2026-04-30" };
  const r = run(a);
  const ref = C.comp395(100000, U.date("2026-01-31"), U.date("2026-04-30"), [{ date: U.date("2026-03-02"), amount: 30000 }]);
  assert.equal(r.summary.find(s => s.big).value, m(ref.total));
  assert(r.table.rows.some(x => x[2] === "70 000"));
  assert.equal(val(r, "Дней просрочки"), "90");
});

t("срок в субботу переносится на понедельник (ст. 193)", () => {
  const r = run({ amount: 10000, due_date: "2026-08-01", paid: "yes", paid_date: "2026-08-10" });
  assert(r.notes[1].includes("перенесён на 03.08.2026"));
  assert.equal(val(r, "Дней просрочки"), "7");
});

t("ошибки: плохая строка оплаты, нет просрочки, оплата до срока", () => {
  assert(run({ amount: 1000, due_date: "2026-08-03", partial: "вчера 500" }).error.includes("Не получилось"));
  assert(run({ amount: 1000, due_date: "2026-08-03", paid: "yes", paid_date: "2026-08-03" }).error.includes("Просрочки нет"));
  assert(run({ amount: 1000, due_date: "2026-08-03", partial: "01.08.2026; 1000" }).error.includes("до окончания срока"));
});

done();
