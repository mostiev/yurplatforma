// node tests/m02.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("m02");
const base = {
  basis: "patent", patent_series: "77 № 2600123456", patent_date: "2026-09-15", patent_by: "ГУ МВД России по г. Москве", patent_region: "г. Москва", same_region: "yes",
  paid_until: "2026-10-14", dms: "АО «СК Пример», полис № 123-456", dms_until: "2027-09-14",
  position: "подсобный рабочий", duties: "погрузочно-разгрузочные работы на складе.", workplace: "г. Москва, ул. Складская, д. 10", start_date: "2026-10-01", probation: "1",
  salary: 60000, pay_days: "25-го и 10-го числа", schedule: "standard", conditions: "ok", city: "г. Москва", doc_date: "2026-09-30",
  buyer_name: "Каримов Азиз Рустамович", citizenship: "Республика Узбекистан", birth_date: "1995-03-12", passport: "FA 1234567, выдан 01.02.2022", inn: "770012345678",
  buyer_address: "г. Москва, ул. Ленина, д. 5, кв. 7",
  em_type: "org", em_name: "ООО «Склад-Сервис»", em_inn: "7701234567", em_ogrn: "1027700000000", em_address: "г. Москва, ул. Складская, д. 10", em_signer: "генерального директора Петрова Петра Петровича, действующего на основании устава",
};

t("патент: сведения о патенте и ДМС, бессрочный договор, 327.5/327.6, зачёт НДФЛ", () => {
  const r = run(base, {});
  assert(!r.stop);
  assert(r.text.includes("патента серии и номера 77 № 2600123456, выданного 15.09.2026 ГУ МВД России по г. Москве, действующего на территории: г. Москва"));
  assert(r.text.includes("полиса) добровольного медицинского страхования: АО «СК Пример»") && r.text.includes("до 14.09.2027"));
  assert(r.text.includes("на неопределённый срок (ч. 1 ст. 327.1") && r.text.includes("испытание продолжительностью 1 месяц"));
  assert(r.text.includes("60 000 (шестьдесят тысяч) рублей") && r.text.includes("п. 6 ст. 227.1") && r.text.includes("ст. 327.5") && r.text.includes("ст. 327.6"));
  assert(r.text.includes("погрузочно-разгрузочные работы на складе.") && !r.text.includes("складе.."));
  assert(r.text.includes("не вправе удерживать паспорт"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("m02.docx", r.a, r.d);
});

t("стопы: ЕАЭС, РВП/ВНЖ, другой регион, патент не оплачен, ДМС истёк, вредные условия", () => {
  assert(run(base, { basis: "eaeu" }).stop.text.includes("ст. 97 Договора о ЕАЭС"));
  assert(run(base, { basis: "resident" }).stop);
  assert(run(base, { same_region: "no" }).stop.title.includes("регионе"));
  assert(run(base, { paid_until: "2026-09-30" }).stop.text.includes("30.09.2026"));
  assert(run(base, { dms_until: "2026-09-20" }).stop.title.includes("ДМС"));
  assert(run(base, { conditions: "harmful" }).stop);
});

t("ИП и физлицо-работодатель; свой режим; без испытания; спецоценки нет", () => {
  const ip = run(base, { em_type: "ip", em_name: "Сидоров Сидор Сидорович", em_inn: "770098765432", em_ogrn: "304770000000000", schedule: "custom", schedule_text: "сменный график 2/2 по 11 часов", probation: "0", conditions: "unknown" });
  assert(ip.text.includes("индивидуальный предприниматель Сидоров Сидор Сидорович") && ip.text.includes("ОГРНИП 304770000000000"));
  assert(ip.text.includes("сменный график 2/2") && ip.text.includes("без испытания") && ip.text.includes("не проведена"));
  const p = run(base, { em_type: "person", em_name: "Иванова Анна Сергеевна", em_passport: "45 10 123456" });
  assert(p.text.includes("Иванова Анна Сергеевна, именуемый(ая)") && p.text.includes("паспорт 45 10 123456"));
  assert.equal(p.a.em_inn, undefined);
});

done();
