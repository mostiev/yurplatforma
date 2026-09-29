// node tests/d59.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d59");
const base = Object.assign({}, spec.defaults, { kind: "med", org_name: "ООО «Клиника здоровья»", org_address: "г. Москва, ул. Тверская, д. 1", years: ["2025", "2024"],
  app_date: "2026-10-01", buyer_name: "Иванова Мария Сергеевна", buyer_birth: "1985-03-10", buyer_inn: "770123456789", buyer_address: "г. Москва, ул. Ленина, д. 5, кв. 7", buyer_phone: "+7 900 123-45-67" });

t("лечение себе: форма и приказ, годы по порядку, передача сведений", () => {
  const r = run(base, {});
  assert(r.text.includes("справку об оплате медицинских услуг для представления в налоговый орган по форме, утверждённой приказом ФНС России от 08.11.2023 № ЕА-7-11/824@, за 2024, 2025 годы."));
  assert(r.text.includes("Медицинские услуги оказаны мне и оплачены мной."));
  assert(r.text.includes("в упрощённом порядке (ст. 221.1") && r.text.includes("ИНН 770123456789") && !r.text.includes("паспорт:"));
  assert(r.text.includes("О готовности справки прошу сообщить по телефону"));
  assert(spec.guidance(r.a, r.d).some(g => g.text.includes("30 дней")));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d59.docx", r.a, r.d);
});

t("обучение ребёнка, без ИНН — паспорт, почтой, без передачи сведений", () => {
  const r = run(base, { kind: "study", years: ["2025"], for_whom: "other", rel: "child", other_name: "Иванов Пётр Андреевич", other_birth: "2005-06-01", contract: "№ 125/24 от 15.01.2024",
    buyer_inn: undefined, buyer_passport: "45 12 345678, выдан 01.02.2020", tax_send: "no", delivery: "mail" });
  assert(r.text.includes("№ ЕД-7-11/755@, за 2025 год.") && r.text.includes("Получатель услуг — мой ребёнок: Иванов Пётр Андреевич, 01.06.2005 г. р. Образовательные услуги оказаны по договору № 125/24 от 15.01.2024 и оплачены мной."));
  assert(r.text.includes("паспорт: 45 12 345678") && !r.text.includes("упрощённом") && r.text.includes("направить почтой по адресу"));
  assert(spec.guidance(r.a, r.d).some(g => g.title.includes("лицензия")));
  assert.deepEqual(allErrors(r.a), []);
});

t("спорт; без годов — ошибка", () => {
  const r = run(base, { kind: "sport" });
  assert(r.text.includes("физкультурно-оздоровительных услуг") && r.text.includes("ЕД-7-11/756@"));
  assert(allErrors(Object.assign({}, base, { years: [] })).includes("years"));
});

done();
