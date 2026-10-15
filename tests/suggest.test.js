// node tests/suggest.test.js — подсказки: какие поля, что уходит в сеть, как форматируется адрес
const assert = require("assert");
require("../assets/suggest.js");
const S = globalThis.Suggest;
let n = 0;
const t = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log("ok —", name); });

(async () => {
  await t("какие поля получают подсказки", () => {
    const c = (id, label, extra) => S.classify(Object.assign({ id, type: "text" }, extra || {}), label);
    assert.equal(c("buyer_address", "Ваш адрес для ответа"), "address");
    assert.equal(c("court_address", "Адрес суда"), "address");
    assert.equal(c("address_basis", "Основание пользования помещением"), null);
    assert.equal(c("court", "Суд"), "court");
    assert.equal(c("court_name", "Арбитражный суд"), "court");
    assert.equal(c("bank", "Ваш банк — куда перечислять деньги"), "bank");
    assert.equal(c("ex_bik", "БИК"), "bik");
    assert.equal(c("debtor_inn", "ИНН должника"), "party");
    assert.equal(c("buyer_inn", "Ваш ИНН"), null, "свой ИНН не отправляем");
    assert.equal(c("buyer_name", "Ваши ФИО"), null);
    assert.equal(c("passport", "Паспорт"), null);
    assert.equal(c("buyer_address", "Адрес", { suggest: false }), null);
    assert.equal(S.classify({ id: "x", type: "textarea" }, "Адрес"), null);
  });

  await t("в сеть уходит только разрешённое", () => {
    assert(S.queryAllowed("party", "7707083893"));
    assert(!S.queryAllowed("party", "772012345678"), "12 цифр — ИНН гражданина, не отправляем");
    assert(S.queryAllowed("party", "772012345678", { ip: true }));
    assert(!S.queryAllowed("party", "Иванов Иван"));
    assert(!S.queryAllowed("address", "Мо") && S.queryAllowed("address", "Моск"));
    assert(S.queryAllowed("bik", "044525") && !S.queryAllowed("bik", "Сбер"));
    S.token = ""; assert(!S.enabled(), "без ключа подсказки выключены");
  });

  await t("адрес — с точками, индексом; неполный адрес продолжает подсказывать", () => {
    assert.equal(S.formatAddress("г Москва, ул Ленина, д 5, кв 7"), "г. Москва, ул. Ленина, д. 5, кв. 7");
    assert.equal(S.formatAddress("Московская обл, г Подольск, пр-кт Ленина, д 1 к 2"), "Московская обл., г. Подольск, пр-кт Ленина, д. 1 к. 2");
    assert.equal(S.formatAddress("Московская обл, Ленинский р-н, д Сапроново"), "Московская обл., Ленинский р-н, д. Сапроново");
    assert.equal(S.formatAddress("г Москва, Варшавский проезд, д 1"), "г. Москва, Варшавский проезд, д. 1");
    assert.equal(S.addressText({ value: "г Москва, ул Ленина, д 5", unrestricted_value: "125009, г Москва, ул Ленина, д 5", data: { house: "5" } }), "125009, г. Москва, ул. Ленина, д. 5");
    assert(S.addressPartial({ data: { street: "Ленина", fias_level: "7" } }));
    assert(!S.addressPartial({ data: { house: "5", fias_level: "8" } }));
  });

  await t("соседние поля: суд → адрес суда, банк → БИК, организация → название и адрес", () => {
    const has = k => ["court", "court_address", "bank", "bik", "debtor_inn", "debtor_name", "debtor_address", "ex_bank", "ex_bik", "ex_corr"].includes(k);
    assert.deepEqual(S.siblings("court", "court", { value: "Хамовнический районный суд", data: { address: "119021, г. Москва, ул. Ефремова, д. 7/2" } }, has), { court_address: "119021, г. Москва, ул. Ефремова, д. 7/2" });
    const bank = { value: "ПАО Сбербанк", data: { bic: "044525225", correspondent_account: "30101810400000000225", name: { payment: "ПАО СБЕРБАНК" } } };
    assert.deepEqual(S.siblings("bank", "bank", bank, has), { bik: "044525225", bank: "ПАО СБЕРБАНК" });
    assert.deepEqual(S.siblings("bik", "ex_bik", bank, has), { ex_bik: "044525225", ex_bank: "ПАО СБЕРБАНК", ex_corr: "30101810400000000225" });
    const org = { value: "ООО \"Ромашка\"", data: { inn: "7701234567", type: "LEGAL", name: { short_with_opf: "ООО \"Ромашка\"" }, address: { unrestricted_value: "125009, г Москва, ул Тверская, д 1" } } };
    assert.deepEqual(S.siblings("party", "debtor_inn", org, has), { debtor_inn: "7701234567", debtor_name: "ООО \"Ромашка\"", debtor_address: "125009, г. Москва, ул. Тверская, д. 1" });
    assert.equal(S.label("party", { value: "x", data: { state: { status: "LIQUIDATED" } } }).sub, "⚠ ликвидирована");
  });

  await t("запрос к DaData: адрес, ключ, кэш", async () => {
    const calls = [];
    S.token = "test-token";
    S.fetch = async (url, opt) => { calls.push({ url, opt }); return { ok: true, json: async () => ({ suggestions: [{ value: "г Москва, ул Ленина" }] }) }; };
    const r1 = await S.query("address", "москва ленина");
    const r2 = await S.query("address", "москва ленина");
    assert.equal(r1[0].value, "г Москва, ул Ленина"); assert.equal(r1, r2); assert.equal(calls.length, 1);
    assert(calls[0].url.endsWith("/suggest/address") && calls[0].opt.headers.Authorization === "Token test-token");
    assert.deepEqual(JSON.parse(calls[0].opt.body), { query: "москва ленина", count: 7 });
    await S.query("bik", "044525225"); assert(calls[1].url.endsWith("/suggest/bank"));
    S.token = "";
  });

  await t("проверки без сети", () => {
    assert.equal(S.offlineHint("address", "г. Москва, ул. Ленина"), "Похоже, не указан номер дома");
    assert.equal(S.offlineHint("address", "г. Москва, ул. Ленина, д. 5, кв. 7"), null);
    assert(S.offlineHint("party", "77012345"));
    assert.equal(S.offlineHint("party", "7701234567"), null);
  });

  console.log(`\n${n} проверок пройдено`);
})().catch(e => { console.error(e); process.exit(1); });
