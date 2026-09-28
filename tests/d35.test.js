// node tests/d35.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d35");
const dd = n => U.iso(U.addDays(U.today(), n));
const ru = n => dd(n).split("-").reverse().join(".");
const base = {
  basis: "receipt", given_date: "2026-03-01", amount: 200000, term: "date", interest: "none", penalty: "law",
  debtor_name: "Сидоров Сидор Сидорович", debtor_address: "г. Москва, ул. Мира, д. 1",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", pay_to: "requisites",
};
function workdayBack(n) { // ближайший рабочий будний день не позже today-n (без праздников в окне теста)
  let d = U.addDays(U.today(), -n);
  while (d.getDay() === 0 || d.getDay() === 6) d = U.addDays(d, -1);
  return d;
}

t("просрочка по сроку: проценты по ст. 395 по ставке ЦБ, 365 дней, до сегодня; 7 дней на возврат", () => {
  const due = workdayBack(30);
  const days = U.daysBetween(due, U.today());
  const r = run(base, { due_date: U.iso(due) });
  assert.equal(r.d.p395.days, days);
  const manual = r.d.p395.parts.reduce((s, p) => s + 200000 * p.rate / 100 / p.yearDays * p.days, 0);
  assert(Math.abs(r.d.p395.total - manual) < 0.02);
  assert(r.text.includes("200 000 (двести тысяч) рублей, что подтверждается вашей распиской от 01.03.2026"));
  assert(r.text.includes("Расчёт процентов по ст. 395") && r.text.includes("/ 365 =") && r.text.includes("в течение 7 дней") && r.text.includes("по день фактического возврата"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨")); assert(!r.stop);
  writeDocx("d35-date.docx", r.a, r.d);
});

t("частичные возвраты после срока уменьшают базу процентов со следующего дня", () => {
  const due = workdayBack(40);
  const pay = U.addDays(due, 10);
  const r = run(base, { due_date: U.iso(due), repaid: `${U.fmtDate(pay)}; 50000` });
  assert.equal(r.d.rest, 150000);
  const bases = [...new Set(r.d.p395.parts.map(p => p.base))];
  assert.deepEqual(bases, [200000, 150000]);
  assert(r.text.includes("Остаток суммы займа составляет 150 000 руб.") && r.text.includes("сумму займа в размере 150 000 руб.") && r.text.includes("в полном объёме не возвращён") && !r.text.includes("руб.."));
});

t("срок перенесён по ст. 193: дата возврата в воскресенье → понедельник", () => {
  // 04.10.2026 — воскресенье
  const r = run(base, { due_date: "2026-10-04" });
  assert.equal(U.fmtDate(r.d.due), "05.10.2026");
});

t("без срока, первое требование: 30 дней по п. 1 ст. 810, процентов по ст. 395 ещё нет", () => {
  const r = run(base, { term: "demand", prev_demand: "no" });
  assert(/^Кому/.test(r.text) && r.text.includes("ТРЕБОВАНИЕ") && r.text.includes("в течение тридцати дней со дня предъявления настоящего требования"));
  assert(!r.text.includes("ст. 395") && r.d.p395 === null);
  assert.deepEqual(allErrors(r.a), []);
  writeDocx("d35-demand.docx", r.a, r.d);
});

t("без срока, требование получено больше 30 дней назад — проценты с 31-го дня (с учётом ст. 193)", () => {
  const got = U.addDays(U.today(), -50);
  const r = run(base, { term: "demand", prev_demand: "yes", prev_demand_date: U.iso(got) });
  assert(r.d.overdue && r.d.p395.total > 0 && r.text.includes("ПРЕТЕНЗИЯ"));
});

t("график: пропущенные платежи, досрочно весь остаток по п. 2 ст. 811, проценты по каждому пропуску", () => {
  const r = run(base, { term: "parts", missed: `${U.fmtDate(workdayBack(45))}; 20000\n${U.fmtDate(workdayBack(15))}; 20000`, repaid: "15.07.2026; 40000" });
  assert(r.text.includes("п. 2 ст. 811") && r.text.includes("всю оставшуюся сумму займа в размере 160 000 руб."));
  assert(r.d.p395.total > 0 && r.d.p395.parts.every(p => p.base === 20000));
});

t("проценты по договору и договорная неустойка вместо ст. 395", () => {
  const due = workdayBack(20);
  const r = run(base, { due_date: U.iso(due), interest: "rate", rate: 10, interest_paid: 1000, penalty: "custom", penalty_rate: 0.1 });
  const days = U.daysBetween(U.date("2026-03-01"), U.today());
  const accrued = Math.round(200000 * 0.10 / 365 * days * 100) / 100;
  assert(Math.abs(r.d.use.accrued - accrued) < 0.05, r.d.use.accrued + " vs " + accrued);
  assert.equal(r.d.pen.total, Math.round(200000 * 0.001 * U.daysBetween(due, U.today()) * 100) / 100);
  assert(r.text.includes("10% годовых") && r.text.includes("уплачено 1 000 руб.") && r.text.includes("неустойку в размере") && !r.text.includes("ст. 395"));
});

t("стопы: срок ещё не наступил; долг уже возвращён", () => {
  assert(run(base, { due_date: dd(10) }).stop);
  assert(run(base, { due_date: U.iso(workdayBack(5)), repaid: "01.09.2026; 200000" }).stop);
});

t("без расписки — подсказка про ст. 162; старый долг — про давность", () => {
  const r = run(base, { basis: "none", due_date: "2023-05-02" });
  const g = spec.guidance(r.a, r.d).map(x => x.text).join(" ");
  assert(g.includes("ст. 162") && g.includes("ст. 196") && g.includes("ст. 1102"));
  assert(!r.d.p395.error, "ставки с 2023 года есть в таблице");
});

done();
