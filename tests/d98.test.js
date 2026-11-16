// node tests/d98.test.js
const assert = require("assert");
const { U, run, allErrors, t, done, writeDocx } = require("./_load")("d98");
const got = U.addDays(U.today(), -3);
const base = {
  evac_date: U.iso(got), place: "г. Москва, ул. Тверская, д. 10", car: "Kia Rio, А123ВС777", protocol: "77 ТС 123456", decision: "№ 18810077260001234567 от 10.11.2026",
  article: "ч. 5 ст. 12.16 КоАП РФ", fine: 3000, got_date: U.iso(got), grounds: ["arrived", "no_video"], desc: "Подошёл до погрузки.",
  move_paid: 7500, store_paid: 1000, pay_org: "ГКУ «АМПП»", to: "head", addressee: "Командиру ОБ ДПС ГИБДД УВД по ЦАО",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва", buyer_phone: "+7 900",
};

t("жалоба: ч. 1.1 и ч. 4 ст. 27.13, отмена и прекращение, возврат 8 500 за эвакуацию и хранение", () => {
  const r = run(base, {});
  assert(r.text.includes("ч. 1.1 ст. 27.13") && r.text.includes("ч. 4 ст. 27.13") && r.text.includes("ст. 1.5 КоАП"));
  assert(r.text.includes("8 500 руб.") && r.text.includes("ч. 11 ст. 27.13") && r.text.includes("Отменить постановление"));
  assert(!r.d.late && !r.text.includes("Восстановить срок"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
  writeDocx("d98.docx", r.a, r.d);
});

t("срок прошёл — просьба восстановить по ч. 2 ст. 30.3", () => {
  const r = run(base, { got_date: "2026-09-01", late_reason: "был(а) в командировке" });
  assert(r.d.late && r.text.includes("1. Восстановить срок") && r.text.includes("ч. 2 ст. 30.3"));
});

t("в суд — «В …»", () => {
  assert(run(base, { to: "court", addressee: "Тверской районный суд г. Москвы" }).text.startsWith("В Тверской районный суд"));
});

done();
