// node tests/d14.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d14");
const base = {
  contract_date: "2025-10-01", address: "г. Москва, ул. Ленина, д. 5, кв. 7", deposit: 60000, deposit_proof: "contract", moved_date: "2026-09-01", act: "clean", notice: "term_end",
  deductions: "all", refund_method: "card", ll_name: "Иванов Иван Иванович", ll_address: "г. Москва, ул. Мира, д. 1",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Тула, ул. Садовая, д. 2", buyer_phone: "+7 900 000-00-00",
};

t("не вернули ничего: вся сумма, п. 2 ст. 381.1, ст. 1102, 7 дней по ст. 314", () => {
  const r = run(base, {});
  assert.equal(r.d.claim, 60000);
  assert(r.text.includes("п. 2 ст. 381.1") && r.text.includes("ст. 1102") && r.text.includes("7 дней") && r.text.includes("ст. 395"));
  assert(r.text.includes("договор прекращён по окончании срока его действия, помещение и ключи возвращены вам по акту без претензий"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d14-all.docx", r.a, r.d);
});

t("согласен с частью удержания: требуем остаток", () => {
  const r = run(base, { deductions: "agreed", agreed_sum: 5000, agreed_reason: "разбитая чашка" });
  assert.equal(r.d.claim, 55000); assert(r.text.includes("55 000") && r.text.includes("5 000"));
});

t("спорное удержание: позиция собственника и наша", () => {
  const r = run(base, { deductions: "claims", landlord_reason: "нужна покраска", my_position: "обычный износ" });
  assert(r.text.includes("Вы ссылаетесь на следующее: нужна покраска") && r.text.includes("обычный износ"));
});

t("срок из договора заменяет 7 дней", () => {
  const txt = run(base, { contract_days: 14 }).text;
  assert(txt.includes("в течение 14 дней, как предусмотрено договором") && !txt.includes("ст. 314"));
});

t("ЗоЗПП не упоминается: спор между физлицами", () => {
  assert(!run(base, {}).text.includes("защите прав потребителей"));
});

done();
