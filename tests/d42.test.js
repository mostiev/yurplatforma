// node tests/d42.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d42");
const common = { collector: "ООО ПКО «Долговой центр»", collector_inn: "7700000000", creditor: "АО «Банк»", contract: "Кредитный договор № 12345 от 01.03.2024",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00" };
const complaint = { ...common, kind: "complaint", fssp: "ГУФССП России по г. Москве", violations: ["night", "third", "lies"], phones: "+7 495 000-00-00", desc: "14.09.2026 в 23:15 позвонили и угрожали уголовным делом.", evidence: ["calls", "records"] };
const refuse = { ...common, kind: "refuse", collector_address: "г. Москва, ул. Тверская, д. 1", overdue_since: "2026-01-10", mode: "refuse", passport: "45 12 345678, выдан МВД 01.02.2020" };

t("жалоба в ФССП: нарушения списком со ссылками на ст. 4, 6, 7; ст. 14.57 КоАП; приложения", () => {
  const r = run(complaint, {});
  assert(r.text.startsWith("В ГУФССП России по г. Москве") && r.text.includes("(ИНН 7700000000)") && r.text.includes("первоначальный кредитор — АО «Банк»"));
  assert(r.text.includes("— осуществляли взаимодействие в запрещённое время") && r.text.includes("ч. 5 ст. 4") && r.text.includes("ч. 3 ст. 6") && r.text.includes("уголовным преследованием"));
  assert(r.text.includes("ст. 14.57") && r.text.includes("1. Скриншоты журнала звонков.\n2. Записи телефонных разговоров."));
  assert.equal(r.a.mode, undefined);
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d42-complaint.docx", r.a, r.d);
});

t("отказ от взаимодействия: п. 2 ч. 1 ст. 8, дата просрочки, 3 рабочих дня", () => {
  const r = run(refuse, {});
  assert(r.text.includes("об отказе от взаимодействия") && r.text.includes("п. 2 ч. 1 ст. 8") && r.text.includes("возникла 10.01.2026") && r.text.includes("трёх рабочих дней"));
  assert(!r.stop); assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d42-refuse.docx", r.a, r.d);
});

t("раньше 4 месяцев — стоп; через адвоката можно сразу", () => {
  const recent = U.iso(U.addDays(U.today(), -30));
  assert(run(refuse, { overdue_since: recent }).stop);
  const r = run(refuse, { overdue_since: recent, mode: "lawyer", lawyer_name: "Смирнов Игорь Олегович", lawyer_reg: "77/12345", lawyer_phone: "+7 900 111-11-11", lawyer_office: "г. Москва, ул. Арбат, д. 1" });
  assert(!r.stop && r.text.includes("только через представителя") && r.text.includes("адвокат Смирнов Игорь Олегович, регистрационный номер в реестре адвокатов 77/12345"));
});

done();
