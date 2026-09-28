// node tests/d41.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d41");
const base = {
  role: "debtor", osp: "Хамовнический ОСП ГУФССП России по г. Москве", bailiff: "Иванова А. А.", ip_no: "123456/26/77001-ИП", ip_date: "2026-05-01", creditor: "ПАО «Банк»",
  violations: ["no_answer", "pm"], app_date: "2026-09-01", app_subject: "о сохранении прожиточного минимума", since: U.iso(U.addDays(U.today(), -2)),
  desc: "15.09.2026 со счёта списана вся зарплата — 32 000 ₽.",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("должник: старшему приставу, ст. 64.1 и 99, требования по каждому нарушению, ст. 121–124, 126", () => {
  const r = run(base, {});
  assert(r.text.startsWith("Начальнику отделения — старшему судебному приставу") && r.text.includes("Должник: Петров Пётр Петрович"));
  assert(r.text.includes("01.09.2026 я подал(а) заявление (ходатайство) — о сохранении прожиточного минимума") && r.text.includes("ч. 5 и 7 ст. 64.1") && r.text.includes("ч. 1.1 ст. 99"));
  assert(r.text.includes("1. Признать незаконными") && r.text.includes("2. Обязать судебного пристава-исполнителя рассмотреть моё заявление") && r.text.includes("3. Обязать судебного пристава-исполнителя вынести постановление о сохранении"));
  assert(r.text.includes("ст. 121–124, 126") && !r.text.includes("Восстановить срок"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d41.docx", r.a, r.d);
});

t("взыскатель: должник в шапке, бездействие по ч. 1 ст. 36; варианты должника не попадают", () => {
  const r = run(base, { role: "creditor", creditor: undefined, debtor_name: "Сидоров С. С.", violations: ["inactive", "pm"] });
  assert(r.text.includes("Взыскатель: Петров Пётр Петрович") && r.text.includes("Должник: Сидоров С. С.") && r.text.includes("ч. 1 ст. 36") && !r.text.includes("ч. 1.1 ст. 99"));
});

t("срок 10 рабочих дней; пропущен — причина и просьба восстановить", () => {
  const r = run(base, { since: "2026-08-01", late_reason: "находился на лечении в больнице" });
  assert(r.d.late && r.text.includes("пропущен по уважительной причине: находился на лечении в больнице") && r.text.includes("1. Восстановить срок подачи жалобы."));
  assert.equal(U.fmtDate(run(base, { since: "2026-10-28" }).d.deadline), "12.11.2026");
});

done();
