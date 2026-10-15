// node tests/d88.test.js
const assert = require("assert");
const { run, spec, U, allErrors, t, done, writeDocx } = require("./_load")("d88");
const base = Object.assign({}, spec.defaults, {
  osp: "Хамовнический ОСП ГУФССП России по г. Москве", ips: [{ no: "12345/26/77001-ИП", creditor: "ПАО «Банк»", sum: 150000 }, { no: "2222/25/77001-ИП" }],
  mil_name: "Петров Сергей Иванович", mil_birth: "1990-01-01", mil_address: "г. Москва, ул. Ленина, д. 5", since: "2026-03-01", proof: "справка войсковой части 12345 от 01.10.2026 № 567",
  buyer_phone: "+7 900 000-00-00", doc_date: U.iso(U.today()),
});

t("сам должник: п. 3 ч. 1 ст. 40 «в», 3 дня, сбор, первое лицо", () => {
  const r = run(base);
  assert(r.text.includes("Должник: Петров Сергей Иванович, 01.01.1990 г. р."));
  assert(r.text.includes("Я, Петров Сергей Иванович, принимаю участие в специальной военной операции с 01.03.2026"));
  assert(r.text.includes("№ 12345/26/77001-ИП (взыскатель — ПАО «Банк», 150 000 ₽); № 2222/25/77001-ИП"));
  assert(r.text.includes("подпункта «в» пункта 3 части 1 статьи 40") && r.text.includes("трёхдневный срок") && r.text.includes("пункт 9 части 5 статьи 112"));
  assert(!r.stop); assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨") && !r.text.includes(".."));
  writeDocx("d88.docx", r.a, r.d);
});

t("член семьи, мобилизация, часть долгов — алименты; возврат списанного", () => {
  const r = run(base, { role: "family", basis: "mob", buyer_name: "Петрова Анна Петровна", relation: "супруга", buyer_address: "г. Москва", excluded: "some", ask_refund: "yes", refund_text: "12 400 ₽ 15.09.2026" });
  assert(r.stop.soft && r.text.includes("призван на военную службу по мобилизации") && r.text.includes("за исключением производств по алиментным"));
  assert(r.text.includes("в отношении него") && r.text.includes("вернуть денежные средства") && r.text.includes("Копия документа о родстве"));
  assert.deepEqual(allErrors(r.a), []);
});

t("только алименты — ссылка на прожиточный минимум; взыскатель — п. 3.1", () => {
  assert.equal(run(base, { excluded: "all" }).stop.link.href, "d38.html");
  const c = run(base, { role: "creditor" });
  assert(c.text.includes("пункта 3.1 части 1 статьи 40") && c.text.includes("Взыскатель: Петров") && !c.text.includes("исполнительский сбор"));
});

done();
