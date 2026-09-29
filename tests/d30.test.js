// node tests/d30.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d30");
const base = { act_no: "3", act_date: "2026-10-25", contract: "№ 5 от 01.10.2026", lines: "Дизайн главной страницы; 1; 40000\nДизайн внутренних страниц; 5; 8000", paid: "no", ex_name: "Петров Пётр Петрович", ex_inn: "771234567890", ex_address: "г. Москва, ул. Ленина, д. 5", ex_phone: "+7 900 000-00-00", ex_bank: "АО «Т-Банк»", ex_account: "40817810000000000010", ex_bik: "044525974", cl_type: "org", cl_name: "ООО «Ромашка»", cl_inn: "7700000000", cl_address: "г. Москва, ул. Тверская, д. 1", cl_signer: "генерального директора Иванова Ивана Ивановича, действующего на основании Устава" };

t("акт: позиции, итог 80 000 прописью, без НДС, претензий нет", () => {
  const r = run(base, {});
  assert.equal(r.d.total, 80000);
  assert(r.text.includes("АКТ № 3") && r.text.includes("2) Дизайн внутренних страниц — 5 × 8 000 руб. = 40 000 руб.") && r.text.includes("80 000 (восемьдесят тысяч) рублей") && r.text.includes("претензий по объёму"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d30.docx", r.a, r.d);
});

t("строка «наименование; сумма» тоже читается", () => {
  assert.equal(run(base, { lines: "Консультация; 5000" }).d.total, 5000);
});

done();
