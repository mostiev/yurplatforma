// node tests/d77.test.js — персональные данные для сайта
const assert = require("assert");
const { spec, run, allErrors, t, done, writeDocx } = require("./_load")("d77");
const base = Object.assign({}, spec.defaults, {
  site: "https://romashka.ru", hosting: "ООО «Бегет»", doc_date: "2026-10-01", processors: [{ name: "СДЭК", what: "доставка заказов" }],
  op_name: "Иванов Иван Иванович", op_inn: "771234567890", op_address: "г. Москва, ул. Мира, д. 1", op_email: "privacy@romashka.ru",
});
t("политика с таблицей целей, отдельное согласие для форм, баннер, чек-лист", () => {
  const r = run(base, {});
  assert(r.text.includes("ПОЛИТИКА") && r.text.includes("Оформление, оплата и доставка заказов | ") && r.text.includes("п. 5 ч. 1 ст. 6"));
  assert(r.text.includes("на территории Российской Федерации") && r.text.includes("ООО «Бегет»") && r.text.includes("СДЭК — доставка заказов"));
  assert(r.text.includes("на обработку персональных данных") && r.text.includes("ответы на обращения") && !r.text.includes("оформление, оплата и доставка заказов;"), "в согласии — только цели, где оно нужно");
  assert(r.text.includes("Текст баннера cookies") && r.text.includes("pd.rkn.gov.ru") && r.text.includes("не должна стоять заранее"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d77.docx", r.a, r.d);
});
t("рассылки — отдельное согласие; РКН уже уведомлён — пункта в чек-листе нет; зарубежный хостинг — предупреждение", () => {
  const r = run(base, { purposes: ["order", "marketing"], rkn: "yes", rkn_no: "77-26-012345" });
  assert(r.text.includes("на получение рекламных") && r.text.includes("77-26-012345") && !r.text.includes("pd.rkn.gov.ru"));
  const f = run(base, { ru_hosting: "no" });
  assert(spec.guidance(f.a, f.d)[0].title.includes("перенос"));
});
done();
