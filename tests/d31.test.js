// node tests/d31.test.js
const assert = require("assert");
const { U, run, allErrors, t, done, writeDocx } = require("./_load")("d31");
const base = { bill_no: "3", bill_date: "2026-10-28", contract: "Договор № 5 от 01.10.2026", lines: "Дизайн главной страницы; 1; 40000\nДизайн внутренних страниц; 5; 8000", pay_days: 5, ex_name: "Петров Пётр Петрович", ex_inn: "771234567890", ex_address: "г. Москва, ул. Ленина, д. 5", ex_phone: "+7 900 000-00-00", ex_bank: "АО «Т-Банк»", ex_account: "40817810000000000010", ex_bik: "044525974", cl_type: "org", cl_name: "ООО «Ромашка»", cl_inn: "7700000000", cl_address: "г. Москва, ул. Тверская, д. 1", cl_signer: "генерального директора Иванова Ивана Ивановича, действующего на основании Устава" };

t("счёт: реквизиты, итог, без НДС, прописью с заглавной, срок 5 рабочих дней с учётом 4 ноября", () => {
  const r = run(base, {});
  assert(r.text.includes("СЧЁТ НА ОПЛАТУ № 3 от 28.10.2026") && r.text.includes("Итого к оплате: 80 000 руб.") && r.text.includes("Сумма прописью: Восемьдесят тысяч рублей.") && r.text.includes("Без НДС"));
  assert(r.text.includes("Оплатить не позднее 05.11.2026") && r.text.includes("БИК 044525974"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d31.docx", r.a, r.d);
});

done();
