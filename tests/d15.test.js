// node tests/d15.test.js
const assert = require("assert");
const { U, run, allErrors, t, done, writeDocx } = require("./_load")("d15");
const iso = n => U.iso(U.addDays(U.today(), n));
const base = {
  from_date: iso(-20), to_date: iso(-15), account: "1234567890", address: "г. Москва, ул. Ленина, д. 5, кв. 7",
  org_name: "ООО «УК Жилкомфорт»", org_address: "г. Москва, ул. Мира, д. 2",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5, кв. 7", buyer_phone: "+7 900 000-00-00",
};

t("качество: АДС, акт с соседями, раздел IX и Приложение 1; Правила определены один раз", () => {
  const r = run(base, { reason: "quality", service: "hot", quality_desc: "не было горячей воды 3 дня", ads: "yes", ads_no: "№ 1234", check_act: "neighbors" });
  assert(r.text.includes("пп. 105–106 Правил") && r.text.includes("п. 110(1)") && r.text.includes("Приложением № 1"));
  assert.equal((r.text.match(/далее — Правила/g) || []).length, 1);
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d15-quality.docx", r.a, r.d);
});

t("неправильное начисление: ч. 6 ст. 157 ЖК и сумма завышения", () => {
  const r = run(base, { reason: "wrong", wrong_desc: "начислено 340 м³ вместо 12", overcharge: 15000 });
  assert(r.text.includes("ч. 6 ст. 157") && r.text.includes("15 000"));
});

t("отсутствие: больше 5 полных дней, до 30 дней после возвращения, только без счётчиков", () => {
  const ok = run(base, { reason: "absence", no_meters: "yes", absence_docs: "билеты", from_date: iso(-20), to_date: iso(-10) });
  assert(!ok.stop && ok.d.fullDays === 9 && ok.text.includes("5 рабочих дней"));
  assert(run(base, { reason: "absence", no_meters: "no" }).stop, "есть счётчики");
  assert(run(base, { reason: "absence", no_meters: "yes", from_date: iso(-20), to_date: iso(-15) }).stop, "ровно 4 полных дня");
  assert(run(base, { reason: "absence", no_meters: "yes", from_date: iso(-20), to_date: iso(-14) }).stop, "ровно 5 полных дней — мало, нужно больше пяти");
  assert(!run(base, { reason: "absence", no_meters: "yes", absence_docs: "билеты", from_date: iso(-20), to_date: iso(-13) }).stop, "6 полных дней — можно");
  assert(run(base, { reason: "absence", no_meters: "yes", from_date: iso(-60), to_date: iso(-40) }).stop, "больше 30 дней после возвращения");
});

done();
