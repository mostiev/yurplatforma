// node tests/d49.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d49");
const base = {
  role: "buyer", make: "Lada Vesta", vin: "xta21800000000001", year: 2021, color: "белый", plate: "а123вс777", pts: "ЭПТС № 164301000000000 от 10.03.2021", sts: "99 00 123456",
  mileage: 58000, defects: "Скол на лобовом стекле\nКоррозия на арке", keys: 2, city: "г. Москва", doc_date: "2026-10-03", price: 950000, pay: "cash", handover: "now",
  seller_name: "Петров Пётр Петрович", seller_birth: "1980-05-01", seller_passport: "45 12 345678, выдан МВД 01.02.2020", seller_address: "г. Москва, ул. Ленина, д. 5", seller_phone: "+7 900 000-00-00",
  buyer_name: "Сидоров Сидор Сидорович", buyer_birth: "1990-03-03", buyer_passport: "45 13 111222, выдан МВД 05.05.2015", buyer_address: "г. Москва, ул. Мира, д. 1", buyer_phone: "+7 900 111-11-11",
};

t("договор: VIN заглавными, цена прописью, недостатки, передача при подписании, 10 дней на регистрацию, расписки в тексте", () => {
  const r = run(base, {});
  assert(r.text.includes("(VIN): XTA21800000000001") && r.text.includes("знак: А123ВС777") && r.text.includes("пробег по показаниям одометра: 58 000 км"));
  assert(r.text.includes("950 000 (девятьсот пятьдесят тысяч) рублей") && r.text.includes("— Скол на лобовом стекле") && r.text.includes("ст. 475"));
  assert(r.text.includes("одновременно является актом приёма-передачи") && r.text.includes("2 комплект(а) ключей") && r.text.includes("п. 3 ч. 3 ст. 8"));
  assert(r.text.includes("Деньги в сумме 950 000") && r.text.includes("Автомобиль, документы и ключи получил(а)"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d49.docx", r.a, r.d);
});

t("оплата переводом после подписания, передача после оплаты — без расписок в подписях", () => {
  const r = run(base, { pay: "transfer_after", pay_days: 3, handover: "after_pay", defects: undefined });
  assert(r.text.includes("в течение 3 дней") && r.text.includes("после получения цены") && !r.text.includes("Деньги в сумме") && !r.text.includes("ключи получил"));
  assert(r.text.includes("О недостатках Автомобиля, не оговорённых в договоре, Продавцу неизвестно"));
});

t("неверный VIN (буква O) — ошибка; подсказки покупателю про залоги и 10 дней", () => {
  assert(allErrors(run(base, { vin: "XTA2180000000000O" }).a).includes("vin"));
  const g = spec.guidance(base, run(base, {}).d).map(x => x.title + x.text).join(" ");
  assert(g.includes("reestr-zalogov.ru") && g.includes("13.10.2026"));
});

done();
