// node tests/d63.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d63");
const base = Object.assign({}, spec.defaults, {
  acc_date: "2026-08-12", acc_place: "г. Москва, ул. Тверская, д. 10", my_car: "Kia Rio, А123ВС777", his_car: "Toyota Camry, В456ОР799",
  fault_doc: "постановлением ГИБДД от 12.08.2026 № 18810077260001234567",
  repair: 520000, uts: 30000, evac: 5000, expert: "ООО «Эксперт-Авто», заключение № 45/26 от 20.08.2026", expertise: 8000,
  insurer: "САО «ВСК»", paid: 310000,
  culprit: "Сидоров Олег Павлович", culprit_address: "г. Москва, ул. Мира, д. 3", court: "Хамовнический районный суд г. Москвы",
  buyer_name: "Иванов Иван Иванович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", app_date: "2026-09-30",
});

t("иск: разница сверх ОСАГО, госпошлина, районный суд", () => {
  const r = run(base, {});
  assert.equal(r.d.total, 555000); assert.equal(r.d.claim, 245000);
  assert.equal(r.d.fee, 8350); // 4 000 + 3% × 145 000
  assert.equal(r.d.court, "районный суд");
  assert(r.text.includes("Цена иска: 245 000 руб.") && r.text.includes("Государственная пошлина: 8 350 руб."));
  assert(r.text.includes("555 000 (пятьсот пятьдесят пять тысяч) рублей − 310 000 (триста десять тысяч) рублей = 245 000 (двести сорок пять тысяч) рублей"));
  assert(r.text.includes("п. 63–64 постановления Пленума") && r.text.includes("№ 6-П"));
  assert(r.text.includes("2. Взыскать с ответчика расходы на оценку") && r.text.includes("3. Взыскать с ответчика расходы по уплате государственной пошлины"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d63.docx", r.a, r.d);
});

t("без ОСАГО — весь ущерб; собственник — второй ответчик", () => {
  const r = run(base, { situation: "no_osago", owner_driver: "no", owner: "Петров Пётр Петрович", owner_address: "г. Москва, ул. Садовая, д. 1" });
  assert.equal(r.d.claim, 555000);
  assert(r.text.includes("п. 6 ст. 4 Федерального закона") && r.text.includes("Ответчик 2: Петров Пётр Петрович") && r.text.includes("с надлежащего ответчика"));
  assert(!r.text.includes("Страховщик"));
});

t("страховая недоплатила: с виновника — сверх надлежащей выплаты", () => {
  const r = run(base, { method_sum: 360000 });
  assert.equal(r.d.claim, 195000);
  assert(spec.guidance(r.a, r.d).some(x => x.title.includes("недоплатила") && /50\s000/.test(x.text)));
});

t("мелкий ущерб — мировой судья; претензия", () => {
  const r = run(base, { repair: 340000, uts: 0, evac: 0, route: "pretension", requisites: "счёт 40817810000000000001" });
  assert.equal(r.d.claim, 30000); assert.equal(r.d.court, "мировой судья");
  assert(r.text.includes("ПРЕТЕНЗИЯ") && r.text.includes("в течение 10 дней") && r.text.includes("перечислив деньги по реквизитам"));
});

t("не обращались к страховщику — стоп; всё покрыто — стоп", () => {
  assert(run(base, { situation: "not_applied" }).stop.text.includes("п. 114"));
  assert(run(base, { paid: 600000 }).stop.title.includes("нечего"));
});

done();
