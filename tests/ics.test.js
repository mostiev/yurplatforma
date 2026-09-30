// Календарь .ics и блоки «Сроки» в документах и калькуляторах
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const load = require("./_load");
const loadCalc = require("./_loadcalc");

const base = load("d50");
const { U, t, done } = base;
const today = U.today();
const iso = n => U.iso(U.addDays(today, n));

t("icsText: структура, событие на весь день, напоминание накануне", () => {
  const s = U.icsText([{ date: new Date(2026, 11, 31), title: "Срок; важный, очень", text: "Строка 1\nСтрока 2" }]);
  assert.ok(s.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(s.endsWith("END:VCALENDAR\r\n"));
  assert.ok(s.includes("DTSTART;VALUE=DATE:20261231\r\n"));
  assert.ok(s.includes("DTEND;VALUE=DATE:20270101\r\n"), "конец — следующий день, через границу года");
  assert.ok(s.includes("SUMMARY:Срок\\; важный\\, очень"));
  assert.ok(s.includes("DESCRIPTION:Строка 1\\nСтрока 2"));
  assert.ok(s.includes("TRIGGER:-PT15H"));
  assert.strictEqual((s.match(/BEGIN:VEVENT/g) || []).length, 1);
});

t("icsText: строки не длиннее 75 байт, перенос не рвёт символы", () => {
  const long = "Очень длинное название срока с кириллицей, которое точно не поместится в одну строку календаря".repeat(3);
  const s = U.icsText([{ date: new Date(2026, 9, 15), title: long, text: long }]);
  const lines = s.split("\r\n");
  lines.forEach(l => assert.ok(Buffer.byteLength(l) <= 75, l));
  const unfolded = s.replace(/\r\n /g, "");
  assert.ok(unfolded.includes("SUMMARY:" + long.replace(/,/g, "\\,")));
});

t("upcoming: только сегодня и позже, по возрастанию, пустые отброшены", () => {
  const ev = U.upcoming([{ date: U.addDays(today, 5), title: "b" }, { date: U.addDays(today, -1), title: "old" }, null, { date: null, title: "x" }, { date: today, title: "a" }]);
  assert.deepStrictEqual(ev.map(e => e.title), ["a", "b"]);
});

// у всех документов с reminders: на значениях по умолчанию функция не падает и возвращает массив событий с датами
const docs = fs.readdirSync(path.join(__dirname, "..", "content")).filter(f => /^d\d+\.js$/.test(f)).map(f => f.slice(0, -3));
let withRem = 0;
docs.forEach(id => {
  let L;
  try { L = load(id); } catch (e) { return; } // варианты поверх базы проверяются в своих тестах
  if (!L.spec || !L.spec.reminders) return;
  withRem++;
  const a = Object.assign({}, L.spec.defaults || {});
  const r = L.spec.reminders(a, L.spec.derive(a));
  assert.ok(Array.isArray(r), id);
  r.forEach(e => assert.ok((e.date === null || e.date === undefined || (e.date instanceof Date && !isNaN(e.date))) && e.title, id + ": " + JSON.stringify(e)));
});
t(`reminders документов работают на пустой анкете (${withRem} шт.)`, () => assert.ok(withRem >= 14));

t("Д-50: жалоба и скидка 25%", () => {
  const { spec } = base;
  const a = { got_date: iso(-2), decision_date: iso(-3) };
  const r = spec.reminders(a, spec.derive(a));
  assert.strictEqual(r.length, 2);
  assert.ok(r[0].title.includes("жалобы"));
  assert.strictEqual(U.iso(r[1].date), iso(27));
});

t("Д-61: за 2 недели, последний день, свидетельство", () => {
  const L = load("d61");
  const a = Object.assign({}, L.spec.defaults, { kind: "accept", death_date: iso(-30) });
  const d = L.spec.derive(a);
  const r = L.spec.reminders(a, d);
  assert.strictEqual(r.length, 3);
  assert.strictEqual(+r[1].date, +d.deadline);
  assert.strictEqual(+r[2].date, +U.addDays(d.deadline, 1));
});

t("Д-02: после истечения срока — ничего", () => {
  const L = load("d02");
  const a = Object.assign({}, L.spec.defaults);
  const r = L.spec.reminders(a, Object.assign(L.spec.derive(a), { late: true, deadline: today }));
  assert.strictEqual(r.length, 0);
});

// калькуляторы
t("К-8: срок принятия наследства", () => {
  const { spec } = loadCalc("k8");
  const r = spec.compute(Object.assign({}, spec.defaults, { death_date: iso(-10), kids: 1 }));
  assert.strictEqual(r.reminders.length, 3);
  assert.ok(r.reminders[1].title.includes("Последний день"));
});

t("К-10: учёт в службе занятости и заявление за 2-й месяц", () => {
  const { spec } = loadCalc("k10");
  const r = spec.compute(Object.assign({}, spec.defaults, { dism: iso(10), pay: 1200000 }));
  assert.ok(r && !r.error, JSON.stringify(r));
  assert.strictEqual(r.reminders.length, 4);
  assert.ok(r.reminders[1].title.includes("службе занятости"));
});

t("К-12: декларация и налог; при освобождении — нет", () => {
  const { spec } = loadCalc("k12");
  const sale = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 20);
  const r = spec.compute(Object.assign({}, spec.defaults, { owned_from: iso(-400), sale_date: U.iso(sale), price: 8000000 }));
  assert.ok(r.reminders.some(e => e.title.includes("3-НДФЛ")));
  assert.ok(r.reminders.some(e => e.title.includes("заплатить налог")));
  assert.ok(r.reminders.some(e => e.title.includes("без налога")));
  const free = spec.compute(Object.assign({}, spec.defaults, { owned_from: "2015-01-10", sale_date: U.iso(sale), price: 8000000 }));
  assert.ok(!free.reminders || free.reminders.length === 0);
});

t("М-05: напоминание за 5 дней до каждой оплаты, до 12-го месяца", () => {
  const { spec } = loadCalc("m05");
  const r = spec.compute(Object.assign({}, spec.defaults, { issue_date: iso(-20), mode: "sum", monthly: 9000, months_paid: 2 }));
  assert.strictEqual(r.reminders.length, 10);
  assert.ok(r.reminders[0].title.startsWith("Оплатить патент"));
  const full = spec.compute(Object.assign({}, spec.defaults, { issue_date: iso(-20), mode: "sum", monthly: 9000, months_paid: 12 }));
  assert.strictEqual(full.reminders.length, 0);
});

done();
