// node tests/d62.test.js
const assert = require("assert");
const { run, spec, U, allErrors, t, done, writeDocx } = require("./_load")("d62", "k11");
const base = Object.assign({}, spec.defaults, {
  basis_court: "мировой судья судебного участка № 123 района Хамовники г. Москвы", basis_no: "2-456/2024", basis_date: "2024-03-01",
  children: "Петрова Анна Сергеевна, 12.03.2018 г. р.", ip_no_f: "12345/24/77001-ИП", osp: "Хамовнический ОСП ГУФССП России по г. Москве",
  from: "2026-01-01", to: "2026-06-30", avg_wage: 100000, paid: 10000,
  debtor_name: "Петров Сергей Иванович", debtor_address: "г. Москва, ул. Мира, д. 3", buyer_name: "Петрова Мария Ивановна", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
  app_date: "2026-09-30",
});

t("приставу: расчёт по средней зарплате, выезд, права, КоАП", () => {
  const r = run(base, {});
  assert(r.text.includes("о расчёте задолженности по алиментам и применении мер"));
  assert(r.text.includes("задолженность составляет 140 000 (сто сорок тысяч) рублей исходя из 25 000 (двадцать пять тысяч) рублей в месяц (1/4 от средней зарплаты в РФ 100 000 ₽)"));
  assert(r.text.includes("исходя из размера средней заработной платы в Российской Федерации на момент взыскания"));
  assert(r.text.includes("ст. 67.1") && r.text.includes("ч. 1 ст. 5.35.1 КоАП") && r.text.includes("направить мне копии"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
});

t("иск о неустойке: таблица по месяцам, цена иска, госпошлина", () => {
  const r = run(base, { route: "court", court: "Мировому судье судебного участка № 12 района Хамовники г. Москвы", ip_no: "12345/24/77001-ИП" });
  // январь: 25 000 − 10 000 = 15 000 × 242 дня (01.02–30.09); февраль 25 000 × 214; …
  const S = r.d.S;
  assert.equal(S.debt, 140000);
  assert.deepEqual(S.rows.map(x => x.late), [242, 214, 183, 153, 122, 92]);
  assert.equal(S.penalty, 15000 * 0.242 + 25000 * (0.214 + 0.183 + 0.153 + 0.122 + 0.092));
  assert(r.text.includes("ИСКОВОЕ ЗАЯВЛЕНИЕ") && r.text.includes("пп. 15 п. 1 ст. 333.36 НК РФ") && r.text.includes("п. 64 постановления Пленума"));
  assert(r.text.includes("Цена иска: 22 730 руб.")); // 15 000 × 0,242 + 25 000 × 0,764
  assert(r.text.includes("по вине ответчика"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d62.docx", r.a, r.d);
});

t("долга нет — стоп для иска", () => {
  assert(run(base, { route: "court", court: "Мировому судье", paid: 200000 }).stop);
});

done();
