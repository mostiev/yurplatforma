// node tests/d33.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d33");
const people = {
  lender_name: "Петров Пётр Петрович", lender_birth: "1980-05-01", lender_passport: "45 12 345678, выдан ГУ МВД России по г. Москве 01.02.2020", lender_address: "г. Москва, ул. Ленина, д. 5",
  borrower_name: "Сидоров Сидор Сидорович", borrower_address: "г. Москва, ул. Мира, д. 1",
};
const loan = { kind: "loan", city: "г. Москва", doc_date: "2026-10-01", amount: 150000, how: "cash", return: "date", due_date: "2027-04-01", interest: "none", penalty: "law", ...people };

t("заём: сумма прописью, беспроцентный прямо, срок, ст. 395 по умолчанию, строки паспорта для заполнения от руки", () => {
  const r = run(loan, {});
  assert(r.text.includes("150 000 (сто пятьдесят тысяч) рублей в качестве займа"));
  assert(r.text.includes("Я, Сидоров Сидор Сидорович, паспорт серия ______"), "паспорт заёмщика не указан — пустые строки");
  assert(r.text.includes("от Петров Пётр Петрович, 01.05.1980 г. р., паспорт 45 12 345678"));
  assert(r.text.includes("Заём является беспроцентным") && r.text.includes("не позднее 01.04.2027") && r.text.includes("п. 1 ст. 395") && r.text.includes("п. 1 ст. 811"));
  assert(r.text.includes("наличными в момент составления") && r.text.includes("1 октября 2026 г."));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d33-loan.docx", r.a, r.d);
});

t("по требованию — 30 дней по п. 1 ст. 810; проценты и своя неустойка", () => {
  const r = run(loan, { return: "demand", interest: "rate", rate: 12.5, rate_pay: "monthly", penalty: "custom", penalty_rate: 0.1 });
  assert(r.text.includes("тридцати дней со дня предъявления") && r.text.includes("12,5% годовых") && r.text.includes("ежемесячно") && r.text.includes("0,1% от невозвращённой суммы"));
  assert.equal(r.a.due_date, undefined);
  assert(!r.text.includes("ст. 395"));
});

t("высокая ставка — подсказка про п. 5 ст. 809", () => {
  const { spec } = require("./_load")("d33");
  const r = run(loan, { interest: "rate", rate: 60, rate_pay: "end" });
  assert(spec.guidance(r.a, r.d).some(g => g.text.includes("п. 5 ст. 809")));
  assert(!spec.guidance(r.a, run(loan, { interest: "rate", rate: 15, rate_pay: "end" }).d).some(g => g.text.includes("п. 5 ст. 809")));
});

t("перевод — дата перевода; дата возврата не раньше расписки", () => {
  const r = run(loan, { how: "transfer", transfer_date: "2026-10-01" });
  assert(r.text.includes("путём перевода на мой банковский счёт 01.10.2026"));
  assert(allErrors(run(loan, { due_date: "2026-09-01" }).a).includes("due_date"));
});

const repay = { kind: "repay", city: "г. Москва", doc_date: "2026-10-01", amount: 50000, how: "cash", basis: "receipt", basis_date: "2026-01-15", ...people };

t("возврат полностью: претензий нет, оригинал возвращён; подписывает займодавец", () => {
  const r = run(repay, { full: "all", original: "returned" });
  assert(/^РАСПИСКА\s+в получении денежных средств в счёт возврата займа/.test(r.text));
  assert(r.text.includes("Я, Петров Пётр Петрович") && r.text.includes("по расписке от 15.01.2026") && r.text.includes("Претензий к заёмщику") && r.text.includes("Оригинал расписки от 15.01.2026 возвращён"));
  assert(r.text.includes("Займодавец:\n\n____________________ (подпись)"));
  assert.equal(r.a.return, undefined, "вопросы о займе скрыты");
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d33-repay.docx", r.a, r.d);
});

t("частичный возврат — остаток, без «претензий не имею» и без вопроса об оригинале", () => {
  const r = run(repay, { full: "part", left: 100000, original: "returned" });
  assert(r.text.includes("Остаток задолженности") && r.text.includes("100 000 (сто тысяч) рублей") && !r.text.includes("Претензий"));
  assert.equal(r.a.original, undefined);
});

t("оригинал утерян — оговорка по п. 2 ст. 408", () => {
  assert(run(repay, { full: "principal", original: "lost" }).text.includes("п. 2 ст. 408"));
});

done();
