// node tests/d85.test.js
const assert = require("assert");
const { run, spec, U, allErrors, t, done, writeDocx } = require("./_load")("d85");
const iso = d => U.iso(d);
const ago = m => iso(U.addMonths(U.today(), -m));
const base = Object.assign({}, spec.defaults, {
  subject: "холодильник Bosch KGN39VL25R", price: 30000, handed_date: ago(3), defect: "Не морозит морозильная камера.", found_date: ago(1),
  seller_name: "Петров Сергей Иванович", seller_contact: "+7 900 111-11-11", buyer_name: "Иванов Иван Иванович", buyer_address: "г. Москва, ул. Мира, д. 1", buyer_phone: "+7 900 000-00-00",
  fix_days: 14, doc_date: iso(U.today()),
});

t("вещь с рук: устранить недостаток, ст. 475 и 477", () => {
  const r = run(base, { proof: "фото и видео" });
  assert(r.text.includes("о недостатках товара") && r.text.includes("за 30 000 (тридцать тысяч) рублей"));
  assert(r.text.includes("пункта 1 статьи 475 ГК РФ ТРЕБУЮ") && r.text.includes("в течение 14 дней"));
  assert(r.text.includes("п. 2 ст. 477 ГК РФ") && r.text.includes("Это подтверждается: фото и видео."));
  assert(r.text.includes("Копия: +7 900 111-11-11") && r.text.includes("Адрес: ______"));
  assert(!r.stop); assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨") && !r.text.includes(".."));
  writeDocx("d85.docx", r.a, r.d);
});

t("существенный недостаток: возврат денег, п. 2 ст. 475, пошлина в подсказке", () => {
  const r = run(base, { demand: "refund", grounds: ["unfixable"], warranty: "yes", warranty_months: 6 });
  assert(r.text.includes("пункта 2 статьи 475") && r.text.includes("Недостаток является существенным: недостаток неустраним."));
  assert(r.text.includes("пункт 2 статьи 476") && r.d.fee === 4000);
  assert(spec.guidance(r.a, r.d).some(x => x.text.includes("мировой судья")));
});

t("мастер: снизить цену, ст. 723 и 724; замена недоступна", () => {
  const r = run(base, { kind: "work", subject: "укладка ламината", demand: "price_cut", amount: 12000, refund_method: "card" });
  assert(r.text.includes("о недостатках выполненной работы") && r.text.includes("пункта 1 статьи 723") && r.text.includes("п. 2 ст. 724"));
  assert(r.text.includes("вернуть мне 12 000 (двенадцать тысяч) рублей на банковскую карту"));
  assert(r.text.includes("статья 395"));
  assert.deepEqual(allErrors(r.a), []);
  const rep = spec.steps[2].questions[0].options.find(o => o.value === "replace");
  assert(rep.disabled({ kind: "work" }) && !rep.disabled({ kind: "goods" }));
});

t("позже двух лет и оговорённый недостаток — мягкие предупреждения", () => {
  assert(run(base, { handed_date: ago(30), found_date: ago(2) }).stop.soft);
  assert(!run(base, { handed_date: ago(30), found_date: ago(2), warranty: "yes", warranty_months: 36 }).stop);
  assert(run(base, { warned: "yes" }).stop.soft);
});

done();
