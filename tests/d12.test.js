// node tests/d12.test.js — конструктор договора найма
const assert = require("assert");
const { U, spec, run, allErrors, t, done, writeDocx } = require("./_load")("d12");
const base = Object.assign({}, spec.defaults, {
  role: "owner", object: "flat", address: "г. Москва, ул. Ленина, д. 5, кв. 7", rooms: 2, area: 54, ownership_doc: "Выписка из ЕГРН от 10.08.2026", owners_count: "one",
  start_date: "2026-10-01", term_months: 11, rent: 60000, pay_day: 5, pay_method: "card", deposit: 60000, utilities: "meters", pets: "no", notice_visits: 24,
  inventory: [{ item: "Диван", qty: 1, state: "good" }, { item: "Холодильник", qty: 1, state: "new" }, {}],
  m_el: 12345.6, m_cold: 234, m_hot: 123,
  ll_name: "Иванов Иван Иванович", ll_birth: "1980-05-10", ll_passport: "45 12 345678, выдан ГУ МВД 01.02.2020", ll_address: "г. Москва, ул. Мира, д. 1", ll_phone: "+7 900 111-11-11",
  tn_foreign: "no", tn_name: "Петров Пётр Петрович", tn_birth: "1998-03-15", tn_passport: "45 20 123456, выдан ГУ МВД 05.06.2021", tn_address: "г. Тула, ул. Садовая, д. 2", tn_phone: "+7 900 222-22-22",
});

t("11 месяцев: краткосрочный, без регистрации, пакет без заглушек", () => {
  const r = run(base, {});
  assert.equal(U.fmtDate(r.d.end), "31.08.2027"); assert(r.d.short && !r.d.needsRegistration);
  assert(r.text.includes("краткосрочным") && !r.text.includes("государственной регистрации"));
  assert(r.text.includes("более двух раз"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d12-11m.docx", r.a, r.d);
});

t("пакет: договор, акт с описью и счётчиками, расписка", () => {
  const r = run(base, {});
  assert(r.text.includes("АКТ ПРИЁМА-ПЕРЕДАЧИ") && r.text.includes("1 | Диван | 1 | хорошее") && r.text.includes("2 | Холодильник | 1 | новое"));
  assert(r.text.includes("Электроэнергия, кВт·ч | 12345,6"));
  assert(r.text.includes("РАСПИСКА") && r.text.includes("120 000 (сто двадцать тысяч) рублей"));
  assert(!run(base, { receipt: "no" }).text.includes("РАСПИСКА"));
  assert.equal(r.d.inventory.length, 2, "пустая строка описи отброшена");
});

t("нумерация пунктов сплошная, ссылки на п. 1.4 и 6.1 верны", () => {
  const r = run(base, {});
  assert(r.text.includes("1.4. Наниматель проживает в Помещении один"));
  assert(r.text.includes("6.1. Наниматель вправе расторгнуть договор"));
  assert(r.text.includes("установленный п. 6.1"));
  for (let s = 1; s <= 7; s++) {
    const nums = [...r.text.matchAll(new RegExp(`(?:^|\\n)${s}\\.(\\d+)\\. `, "g"))].map(m => +m[1]);
    nums.forEach((x, i) => assert.equal(x, i + 1, `раздел ${s}`));
  }
});

t("первый платёж: месяц + последний месяц + залог", () => {
  const r = run(base, { prepay_last: "yes" });
  assert.equal(r.d.firstPay, 180000);
  assert(r.text.includes("плату за последний месяц найма — 60 000 руб."));
});

t("2 года: регистрация, ст. 684, три экземпляра, индексация", () => {
  const r = run(base, { term_months: 24, indexation: "pct", index_pct: 5 });
  assert(r.d.needsRegistration && r.text.includes("п. 2 ст. 674") && r.text.includes("трёх экземплярах") && r.text.includes("за шесть месяцев") && r.text.includes("ст. 684"));
  assert(r.text.includes("не более чем на 5%") && r.text.includes("начиная с 01.10.2027"));
  assert(!run(base, { indexation: "pct", index_pct: 5 }).text.includes("не более чем на 5%"), "в 11 месяцах индексации нет");
});

t("залог: ст. 381.1, удержание за непредупреждённые дни; без залога — нет", () => {
  const r = run(base, {});
  assert(r.text.includes("ст. 381.1") && r.text.includes("за дни, недостающие"));
  assert(!run(base, { early_deposit: "return" }).text.includes("за дни, недостающие"));
  const no = run(base, { deposit: undefined });
  assert(!no.text.includes("Обеспечительный платёж (ст. 381.1") && no.a.early_deposit === undefined);
});

t("отказ наймодателя без суда: перечень оснований; без него — только суд", () => {
  const r = run(base, { grounds: ["late", "rules"], late_days: 15, ll_notice: 10 });
  assert(r.text.includes("а) невнесение платы за наём более чем на 15") && r.text.includes("б) повторное нарушение"));
  assert(r.text.includes("не менее чем за 10 дней"));
  assert(!run(base, { ll_refusal: "no" }).text.includes("внесудебном"));
});

t("правила: животные, курение, гости, поднаём, ремонт до суммы", () => {
  const r = run(base, { pets: "yes", pets_desc: "кошка", smoking: "balcony", guests: "limit", guests_limit: 3, sublet: "consent", repairs: "limit", repair_limit: 5000 });
  assert(r.text.includes("(кошка)") && r.text.includes("только на балконе") && r.text.includes("более 3 ночей подряд") && r.text.includes("посуточно, только с письменного согласия") && r.text.includes("не превышает 5 000 руб."));
});

t("жильцы — таблица и старый формат строкой", () => {
  const r = run(base, { residents: [{ name: "Петрова Анна Ивановна", relation: "супруга" }, { name: "Петров Илья Петрович" }] });
  assert(r.text.includes("Петрова Анна Ивановна (супруга), Петров Илья Петрович") && r.text.includes("ст. 677"));
  assert.equal(run(base, { residents: "А, Б" }).d.residents.length, 2);
});

t("несколько собственников — согласие в приложении № 2 с именами и долями", () => {
  const r = run(base, { owners_count: "many", co_owners: [{ name: "Иванова Мария Петровна", share: "1/2" }] });
  assert(r.text.includes("Приложение № 2") && r.text.includes("Иванова Мария Петровна (доля в праве 1/2)") && r.text.includes("ст. 246, 247 ГК РФ"));
  assert.deepEqual(allErrors(r.a), []);
  assert(allErrors(Object.assign({}, r.a, { co_owners: [{ share: "1/2" }] })).includes("co_owners"), "ФИО обязательно");
});

t("регистрация по месту пребывания — согласие или отказ", () => {
  assert(run(base, {}).text.includes("даёт согласие на регистрацию Нанимателя"));
  assert(run(base, { reg_stay: "no" }).text.includes("не предусмотрена"));
});

t("предмет — в винительном падеже, без двойных точек", () => {
  assert(run(base, { object: "house", rooms: 4 }).text.includes("жилой дом (4 комн.), расположенный"));
  assert(run(base, { object: "room" }).text.includes("комнату в квартире, расположенную"));
  assert(run(base, {}).text.includes("для проживания 2-комнатную квартиру, расположенную"));
  assert(!run(base, {}).text.includes("руб.."));
});

t("день оплаты не позже 28-го", () => {
  assert(allErrors(run(base, { pay_day: 31 }).a).includes("pay_day"));
});

t("сроки: оплаты каждый месяц, конец договора; последний месяц вперёд — без последней оплаты", () => {
  const r = run(base, {});
  const ev = spec.reminders(r.a, r.d);
  const pays = ev.filter(e => e.title.startsWith("Оплата"));
  assert.equal(pays.length, 10); assert.equal(U.fmtDate(pays[0].date), "05.11.2026");
  assert(ev.some(e => e.title.startsWith("Последний день")));
  const r2 = run(base, { prepay_last: "yes" });
  assert.equal(spec.reminders(r2.a, r2.d).filter(e => e.title.startsWith("Оплата")).length, 9);
  const r3 = run(base, { term_months: 12 });
  assert(spec.reminders(r3.a, r3.d).some(e => e.title.includes("Росреестр")));
});

done();
