// node tests/d86.test.js
const assert = require("assert");
const { run, spec, U, allErrors, t, done, writeDocx } = require("./_load")("d86");
const iso = d => U.iso(d);
const ago = m => iso(U.addMonths(U.today(), -m));
const base = Object.assign({}, spec.defaults, {
  product: "холодильник Bosch KGN39VL25R", serial: "1234", price: 60000, bought_date: ago(40), warranty_months: 12,
  defect: "Перестал работать компрессор.", found_date: ago(1), grounds: ["costly"],
  maker: "ООО «БСХ Бытовые Приборы»", maker_address: "г. Санкт-Петербург, ул. Связи, д. 1",
  buyer_name: "Иванов Иван Иванович", buyer_address: "г. Москва, ул. Мира, д. 1", buyer_phone: "+7 900 000-00-00", doc_date: iso(U.today()),
});

t("первый шаг: устранить по п. 6 ст. 19, 10 лет без срока службы", () => {
  const r = run(base, { expert: "yes", expert_text: "заключение ООО «Экспертиза» № 15 от 10.10.2026" });
  assert(r.text.includes("о безвозмездном устранении существенного недостатка") && r.text.includes("пункта 6 статьи 19 Закона ТРЕБУЮ"));
  assert(r.text.includes("по истечении гарантийного срока и двух лет") && r.text.includes("десяти лет со дня передачи"));
  assert(r.text.includes("что подтверждается: заключение ООО «Экспертиза» № 15 от 10.10.2026."));
  assert(r.text.includes("в течение 20 дней") && spec.reminders(r.a, r.d)[0].title.includes("20 дней"));
  assert(!r.stop); assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨") && !r.text.includes(".."));
  writeDocx("d86.docx", r.a, r.d);
});

t("второй шаг: возврат денег, неустойка 1%", () => {
  const r = run(base, { stage: "second", first_date: ago(1), demand2: "refund" });
  assert(r.text.includes("о возврате денег за товар") && r.text.includes("60 000 (шестьдесят тысяч) рублей на банковскую карту") && r.text.includes("статья 23 Закона"));
  assert.deepEqual(allErrors(r.a), []);
  assert(run(base, { stage: "second", demand2: "price_cut", amount: 20000 }).text.includes("о соразмерном уменьшении цены"));
});

t("в пределах двух лет → ссылка на претензию продавцу; после срока службы — мягко", () => {
  assert.equal(run(base, { bought_date: ago(18) }).stop.link.href, "d01.html");
  assert.equal(run(base, { bought_date: ago(30), warranty_months: 36 }).stop.link.href, "d01.html");
  const late = run(base, { life: "yes", life_years: 3 });
  assert(late.stop.soft && late.stop.title.includes("срока службы"));
  assert(run(base, { life: "yes", life_years: 7 }).text.includes("срока службы (7 лет)"));
});

done();
