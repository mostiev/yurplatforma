// node tests/d91.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d91");
const base = {
  subject: "goods", product: "смартфон Samsung Galaxy S25", contract_date: "2026-06-10", price: 89990, seller_kind: "org", defendant_fin: "no",
  seller_name: "ООО «Электросила»", seller_inn: "7701234567", seller_address: "г. Москва, ул. Тверская, д. 1",
  violation: "Через 2 месяца смартфон перестал заряжаться.", claim_sent: "yes", claim_date: "2026-09-01", claim_demand: "вернуть 89 990 руб.", claim_result: "silent",
  claims: ["refund", "penalty", "moral"], refund_amount: 89990, goods_back: "me", penalty_rate: "r1", penalty_amount: 45000, penalty_from: "2026-09-12", penalty_base: 89990,
  moral_amount: 10000, venue: "me", court: "Мировой судья судебного участка № 158 района Хамовники г. Москвы",
  buyer_name: "Петров Пётр Петрович", buyer_birth: "1990-05-01", buyer_birthplace: "г. Москва", buyer_id: "СНИЛС 123-456-789 00",
  buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("товар: цена иска без морального вреда и штрафа; 135 000 > 100 000 → районный суд; без пошлины", () => {
  const r = run(base, {});
  assert.equal(r.d.price, 134990); assert(!r.d.mirovoy && r.d.fee === 0);
  assert(r.text.includes("Цена иска: 134 990 руб.") && r.text.includes("истец освобождён (п. 3 ст. 17"));
  assert(r.text.includes("Истец: Петров Пётр Петрович\nдата и место рождения: 01.05.1990, г. Москва\nСНИЛС"));
  assert(r.text.includes("ИСКОВОЕ ЗАЯВЛЕНИЕ") && r.text.includes("Товар я готов(а) возвратить ответчику"));
  assert(r.text.includes("1. Взыскать с ООО «Электросила» в мою пользу уплаченные по договору 89 990 руб."));
  assert(r.text.includes("по день фактического исполнения обязательства, а всего неустойки — не более 89 990 руб."));
  assert(r.text.includes("штраф в размере 50% от суммы, присуждённой судом") && r.text.includes("п. 6 ст. 132 ГПК РФ"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
  assert(!r.stop);
  writeDocx("d91.docx", r.a, r.d);
});

t("до 100 000 ₽ — мировой судья, ссылка на п. 5 ч. 1 ст. 23", () => {
  const r = run(base, { claims: ["refund", "moral"], refund_amount: 60000 });
  assert(r.d.mirovoy && r.text.includes("п. 5 ч. 1 ст. 23 ГПК РФ"));
});

t("свыше 1 млн — пошлина только с разницы", () => {
  const r = run(base, { subject: "work", product: "ремонт квартиры", price: 1500000, claims: ["refund"], refund_amount: 1500000, penalty_rate: undefined });
  assert.equal(r.d.fee, 30000 - 25000); assert(r.text.includes("Государственная пошлина: 5 000 руб."));
  assert(r.text.includes("ст. 28, 29, 31") && !r.text.includes("Товар я готов"));
});

t("работа: неустойка 3%, предел — цена работы", () => {
  const r = run(base, { subject: "work", price: 200000, claims: ["penalty"], penalty_rate: "r3", penalty_amount: 120000, penalty_base: 200000 });
  assert(r.text.includes("3% от 200 000 руб.") && r.text.includes("п. 5 ст. 28") && r.text.includes("не более 200 000 руб."));
});

t("частное лицо — стоп со ссылкой на Д-85", () => {
  const r = run(base, { seller_kind: "person" });
  assert(r.stop && !r.stop.soft && r.stop.link.href === "d85.html");
});

t("банк до 500 000 без финуполномоченного — стоп; после решения — абзац о досудебном порядке", () => {
  assert(run(base, { defendant_fin: "yes" }).stop.title.includes("финансовый уполномоченный"));
  const r = run(base, { defendant_fin: "yes", ombudsman: "done", ombudsman_desc: "№ У-26-1 от 10.10.2026" });
  assert(!r.stop && r.text.includes("Обязательный досудебный порядок соблюдён") && r.text.includes("Решение финансового уполномоченного."));
});

t("без претензии — мягкое предупреждение, документ собирается", () => {
  const r = run(base, { claim_sent: "no" });
  assert(r.stop.soft && !r.text.includes("получил мою претензию"));
});

done();
