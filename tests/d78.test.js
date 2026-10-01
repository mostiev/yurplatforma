// node tests/d78.test.js — оферта интернет-магазина
const assert = require("assert");
const { spec, run, allErrors, t, done, writeDocx } = require("./_load")("d78");
const base = Object.assign({}, spec.defaults, {
  site: "https://romashka.ru", goods: "одежда и аксессуары", ship_terms: "по Москве 1–2 дня", return_address: "г. Москва, ул. Складская, д. 10", privacy_url: "https://romashka.ru/privacy", doc_date: "2026-10-01",
  sl_name: "Иванов Иван Иванович", sl_inn: "771234567890", sl_ogrn: "312774600000012", sl_address: "г. Москва, ул. Мира, д. 1", sl_email: "shop@romashka.ru", sl_phone: "+7 900 000-00-00",
});
t("оферта: реквизиты, 7 дней / 3 месяца, КС 7-П, подсудность по выбору покупателя, страница возврата", () => {
  const r = run(base, {});
  assert(r.text.includes("ИП Иванов Иван Иванович, ОГРНИП 312774600000012") && r.text.includes("№ 657"));
  assert(r.text.includes("в течение 7 дней") && r.text.includes("3 месяца") && r.text.includes("№ 7-П") && r.text.includes("п. 2 ст. 17") && r.text.includes("не является обязательным"));
  assert(r.text.includes("Возврат и обмен — текст для страницы сайта"));
  assert(!/по месту нахождения Продавца\.|только по месту/.test(r.text));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d78.docx", r.a, r.d);
});
t("товары на заказ — исключение из возврата", () => {
  assert(run(base, { custom: "yes" }).text.includes("индивидуально-определёнными"));
  assert(!run(base, {}).text.includes("индивидуально-определёнными"));
});
done();
