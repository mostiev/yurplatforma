// node tests/d101.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d101");
const base = {
  who: "parent", double: "no", salary: 55000,
  children: [{ name: "Петров Иван", birth: "2000-01-01", status: "adult" }, { name: "Петрова Анна", birth: "2015-05-01", status: "minor" }, { name: "Петров Олег", birth: "2019-03-01", status: "disabled" }],
  org_name: "ООО «Ромашка»", head_position: "Генеральному директору", head_name: "Иванову И. И.", buyer_name: "Петров Пётр Петрович", from_month: "января",
};

t("очерёдность по всем детям: взрослый первый, Анна — 2-я (2 800), Олег — 3-й с инвалидностью (6 000 + 12 000); 8 месяцев при 55 000", () => {
  const r = run(base, {});
  assert.equal(r.d.monthly, 2800 + 18000); assert.equal(r.d.months, 8);
  assert(r.text.includes("Петрова Анна, 01.05.2015 г. р. (2-й ребёнок): 2 800 руб.") && r.text.includes("(3-й ребёнок, ребёнок-инвалид): 18 000 руб."));
  assert(r.text.includes("учитывается при определении очерёдности") && r.text.includes("Справка об инвалидности"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
  writeDocx("d101.docx", r.a, r.d);
});

t("опекун: за инвалидность 6 000; двойной вычет при отказе второго родителя — его заявление на второй странице", () => {
  assert.equal(run(base, { who: "guardian" }).d.monthly, 2800 + 12000);
  const r = run(base, { double: "refused", other_name: "Петрова Мария", other_work: "ООО «Вектор»" });
  assert.equal(r.d.monthly, (2800 + 18000) * 2);
  assert(r.text.includes("об отказе от стандартного налогового вычета") && r.text.includes("в двойном размере"));
});

t("только взрослые дети — стоп со ссылкой на К-6", () => {
  assert(run(base, { children: [{ name: "А", birth: "1999-01-01", status: "adult" }] }).stop.link.href === "k6.html");
});

done();
