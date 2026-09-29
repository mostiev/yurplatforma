// node tests/d58.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d58");
const base = { purpose: "salary", employer: "ООО «Ромашка», ИНН 7701234567", salary_period: "за сентябрь 2026 года", city: "г. Москва", issue_date: "2026-10-01",
  pr_name: "Петров Пётр Петрович", pr_birth: "1980-05-12", pr_passport: "45 12 345678, выдан ГУ МВД России по г. Москве 01.02.2020", pr_address: "г. Москва, ул. Ленина, д. 5",
  ag_name: "Петрова Анна Сергеевна", ag_birth: "1982-07-01", ag_passport: "45 13 123456, выдан ГУ МВД России по г. Москве 02.03.2021", ag_address: "г. Москва, ул. Ленина, д. 5" };

t("зарплата: дата прописью, полномочия, год по умолчанию, без передоверия", () => {
  const r = run(base, {});
  assert(r.text.includes("1 октября 2026 г.") && r.text.includes("уполномочиваю представителя:\n\nПетрова Анна Сергеевна, 01.07.1982 г. р.") && r.text.includes("(далее — Представитель)."));
  assert(r.text.includes("Представитель вправе получить причитающуюся мне заработную плату и иные выплаты, связанные с трудовыми отношениями, за сентябрь 2026 года, в ООО «Ромашка»"));
  assert(r.text.includes("сроком на один год без права передоверия"));
  assert(spec.guidance(r.a, r.d)[0].text.includes("п. 3 ст. 185.1"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d58.docx", r.a, r.d);
});

t("машина и срок; организация без двойной точки", () => {
  const c = run(base, { purpose: "car", car: "Kia Rio, А123ВС777", car_sts: "99 12 345678", until_date: "2027-03-31" });
  assert(c.text.includes("Госавтоинспекции") && c.text.includes("Kia Rio, А123ВС777") && c.text.includes("до 31.03.2027 включительно"));
  assert(spec.guidance(c.a, c.d)[0].title.includes("доверенность не нужна"));
  const o = run(base, { purpose: "docs", org: "ГБОУ «Школа № 123»", org_tasks: "получить справку об обучении." });
  assert(o.text.includes("ГБОУ «Школа № 123»: получить справку об обучении, расписываться") && !o.text.includes("обучении.,"));
});

t("недвижимость, суд, банк — стоп", () => {
  assert(run(base, { purpose: "realty" }).stop.text.includes("п. 1 ст. 185.1"));
  assert(run(base, { purpose: "court" }).stop.text.includes("ч. 2 ст. 53 ГПК"));
  assert(run(base, { purpose: "bank" }).stop);
});

done();
