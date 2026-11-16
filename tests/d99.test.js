// node tests/d99.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d99");
const base = {
  amount: 3000000, method: "cash", when: "now", purpose: "на приобретение квартиры", personal: "yes",
  donor_name: "Петрова Ольга Ивановна", donor_birth: "1960-01-01", donor_address: "г. Москва", relation: "мать",
  buyer_name: "Петров Пётр Петрович", buyer_birth: "1988-01-01", buyer_address: "г. Москва", city: "Москва",
};

t("наличные сейчас: сумма прописью, личная собственность по ст. 36 СК, НДФЛ п. 18.1, расписка", () => {
  const r = run(base, {});
  assert(r.text.includes("3 000 000 (") && r.text.includes("п. 1 ст. 36 Семейного кодекса") && r.text.includes("п. 18.1 ст. 217"));
  assert(r.text.includes("РАСПИСКА") && r.text.includes("безвозмездно передаёт"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
  writeDocx("d99.docx", r.a, r.d);
});

t("обещание дарения переводом: срок, ст. 577, без расписки", () => {
  const r = run(base, { method: "transfer", when: "future", pay_date: "2027-03-01" });
  assert(r.text.includes("обязуется безвозмездно передать") && r.text.includes("до 01.03.2027") && r.text.includes("ст. 577") && !r.text.includes("РАСПИСКА"));
});

done();
