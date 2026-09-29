// node tests/d32.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d32");
const base = { contract: "№ 5 от 01.09.2026", subject: "дизайн сайта", accepted: "act", act_date: "2026-09-10", amount: 80000, partial: "05.09.2026; 20000", due_date: "2026-09-15", ex_name: "Петров Пётр Петрович", ex_inn: "771234567890", ex_address: "г. Москва, ул. Ленина, д. 5", ex_phone: "+7 900 000-00-00", ex_bank: "АО «Т-Банк»", ex_account: "40817810000000000010", ex_bik: "044525974", cl_type: "org", cl_name: "ООО «Ромашка»", cl_inn: "7700000000", cl_address: "г. Москва, ул. Тверская, д. 1", cl_signer: "генерального директора Иванова Ивана Ивановича, действующего на основании Устава" };

t("претензия: долг 60 000 с учётом предоплаты, проценты 395 с 16.09 на остаток, реквизиты", () => {
  const r = run(base, {});
  assert.equal(r.d.rest, 60000);
  assert(r.d.p395.parts.every(p => p.base === 60000) && U.fmtDate(r.d.p395.parts[0].from) === "16.09.2026");
  assert(r.text.includes("Задолженность — 60 000 руб.") && r.text.includes("ст. 309, 310, 781") && r.text.includes("ст. 395") && r.text.includes("Счёт № 40817810000000000010"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨")); assert(!r.stop);
  writeDocx("d32.docx", r.a, r.d);
});

t("срок в субботу 03.10.2026 → понедельник 05.10; срок не прошёл — стоп", () => {
  const r = run(base, { due_date: "2026-10-03" });
  assert.equal(U.fmtDate(r.d.due), "05.10.2026");
  assert(run(base, { due_date: U.iso(U.addDays(U.today(), 5)) }).stop);
});

done();
