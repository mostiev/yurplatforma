// node tests/d24.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d24");
const base = { stage: "before", regime: "separate", items: "Квартира по адресу г. Москва, ул. Ленина, д. 5, кв. 7; жена\nАвтомобиль Kia Rio; муж\nДача в Подмосковье; общее",
  debts: "own", income: "own", support: "custom", support_payer: "m", support_sum: 50000, support_months: 12, city: "г. Москва",
  m_name: "Петров Пётр Петрович", m_birth: "1988-01-01", m_passport: "45 12 345678", m_address: "г. Москва, ул. Мира, д. 1",
  w_name: "Иванова Анна Ивановна", w_birth: "1990-01-01", w_passport: "45 13 111222", w_address: "г. Москва, ул. Ленина, д. 5" };

t("раздельный режим, отдельное имущество по владельцам, долги, содержание, запреты п. 3 ст. 42", () => {
  const r = run(base, {});
  assert(r.text.includes("вступающие в брак") && r.text.includes("со дня государственной регистрации заключения брака") && r.text.includes("на имя которого оно приобретено"));
  assert(r.text.includes("3.1. Квартира по адресу г. Москва, ул. Ленина, д. 5, кв. 7 — является собственностью Супруги") && r.text.includes("3.2. Автомобиль Kia Rio — является собственностью Супруга") && r.text.includes("обоих супругов в равных долях"));
  assert(r.text.includes("ст. 46 СК") && r.text.includes("Супруг выплачивает Супруге содержание в размере 50 000") && r.text.includes("п. 3 ст. 42"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d24.docx", r.a, r.d);
});

t("долевой режим 60/40; в браке — сведения о браке", () => {
  const r = run(base, { regime: "shares", share_m: 60, stage: "married", marriage: "15.06.2019, запись № 1234" });
  assert(r.text.includes("доля Супруга — 60%, доля Супруги — 40%") && r.text.includes("состоящие в браке (15.06.2019"));
});

done();
