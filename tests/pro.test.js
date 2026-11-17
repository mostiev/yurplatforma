// node tests/pro.test.js — тариф «Бизнес»: ключи, компании, логотип, отметка, «Сказать спасибо»
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { subtle } = require("crypto").webcrypto;
const { sign } = require("../tools/pro-keys");

function loadPro(store) {
  const mem = store || {};
  const ctx = { TextEncoder, TextDecoder, atob, btoa, console, Date, crypto: require("crypto").webcrypto,
    localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } } };
  ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ["assets/docx.js", "assets/pro.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
  return { Pro: ctx.Pro, Docx: ctx.Docx, mem };
}
const iso = d => d.toISOString().slice(0, 10);
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok —", name); };

(async () => {
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const priv = await subtle.exportKey("jwk", kp.privateKey), pub = await subtle.exportKey("jwk", kp.publicKey);
  const later = iso(new Date(Date.now() + 30 * 864e5)), past = iso(new Date(Date.now() - 864e5));

  await t("ключ: настоящий — действует; просроченный, подделанный и чужой — нет", async () => {
    const { Pro } = loadPro();
    const good = await sign({ n: "ip@example.ru", e: later, i: iso(new Date()) }, priv);
    const r = await Pro.verify(good, pub);
    assert(r.ok && r.name === "ip@example.ru");
    const old = await Pro.verify(await sign({ n: "x", e: past }, priv), pub);
    assert(!old.ok && old.expired && old.why.includes("закончился"));
    const [head, sig] = good.split(".");
    const forged = "YP-" + Buffer.from(JSON.stringify({ n: "x", e: "2099-01-01" })).toString("base64url") + "." + sig;
    assert(!(await Pro.verify(forged, pub)).ok);
    assert(!(await Pro.verify("abc", pub)).ok && !(await Pro.verify(head + ".AAAA", pub)).ok);
    const other = await subtle.exportKey("jwk", (await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])).publicKey);
    assert(!(await Pro.verify(good, other)).ok);
  });

  await t("включение: ключ сохраняется в браузере и перепроверяется при следующей загрузке", async () => {
    const store = {};
    const a = loadPro(store); a.Pro.PUBLIC_JWK = pub;
    const key = await sign({ n: "a", e: later }, priv);
    assert((await a.Pro.activate(key)).ok && a.Pro.active && JSON.parse(store["yp-pro"]).key === key);
    const b = loadPro(store); b.Pro.PUBLIC_JWK = pub;
    assert(await b.Pro.recheck());
    store["yp-pro"] = JSON.stringify({ key: key.slice(0, -3) + "AAA" });
    assert(!(await b.Pro.recheck()) && !b.Pro.active);
    b.Pro.deactivate(); assert(!("yp-pro" in store));
  });

  await t("компании: бесплатно одна, в тарифе — сколько угодно; перенос в анкету и обратно", async () => {
    const { Pro } = loadPro();
    assert(Pro.companies.save({ kind: "org", name: "ООО «Ромашка»", inn: "7701234567", head_pos: "Генеральный директор", head: "Иванов Иван Иванович" }));
    assert(!Pro.companies.canAdd() && !Pro.companies.save({ kind: "ip", name: "Петров Пётр Петрович" }));
    Pro.active = true;
    assert(Pro.companies.save({ kind: "ip", name: "Петров Пётр Петрович", inn: "770123456789" }));
    assert.equal(Pro.companies.list().length, 2);
    const c = Pro.companies.list()[0];
    const a = Pro.companies.toAnswers(c, "cl", "biz");
    assert(a.cl_kind === "org" && a.cl_name === "ООО «Ромашка»" && a.cl_head === "Иванов Иван Иванович");
    assert.deepEqual(JSON.parse(JSON.stringify(Pro.companies.fromAnswers(a, "cl", "biz"))), { kind: "org", name: "ООО «Ромашка»", inn: "7701234567", head_pos: "Генеральный директор", head: "Иванов Иван Иванович" });
    const fa = Pro.companies.toAnswers({ kind: "ip", name: "Петров П. П.", inn: "770123456789", head: "x" }, "cl", "client");
    assert(fa.cl_type === "org" && fa.cl_name === "ИП Петров П. П." && fa.cl_signer === undefined);
  });

  await t("стороны находятся в договорах (bizParty) и в документах самозанятых (ex_, cl_)", async () => {
    const { Pro } = loadPro();
    const load = id => require("./_load")(id).spec;
    const ps = Pro.parties(load("d68"));
    assert(ps.some(p => p.p === "ex" && p.mode === "biz" && p.role === "Исполнитель") && ps.some(p => p.p === "cl" && p.role === "Заказчик"));
    assert.equal(new Set(ps.map(p => p.p)).size, ps.length); // сторона, которая встречается в анкете дважды, — одна
    const f = Pro.parties(load("d30"));
    assert(f.some(p => p.mode === "freelancer") && f.some(p => p.mode === "client"));
    assert.equal(Pro.parties(load("d01")).length, 0);
  });

  await t("сохранённая компания проходит проверки анкеты договора", async () => {
    const L = require("./_load")("d68");
    const { Pro } = loadPro();
    const a = Pro.companies.toAnswers({ kind: "org", name: "ООО «Ромашка»", inn: "7701234567", ogrn: "1027700000000", kpp: "770101001", address: "г. Москва", head_pos: "Генеральный директор", head: "Иванов Иван Иванович", email: "a@b.ru", bank: "ПАО Сбербанк", account: "40702810000000000001", bik: "044525225" }, "ex", "biz");
    const errs = L.spec.steps.filter(s => s.questions.some(q => q.id === "ex_kind")).flatMap(s => Object.keys(L.Engine.stepErrors(L.spec, s, a)));
    assert.deepEqual(errs, []);
  });

  await t("отметка «Составлено на…» — только в бизнес-документах и только без тарифа; «спасибо» — не там, где человеку тяжело", async () => {
    const { Pro } = loadPro();
    assert(Pro.mark("d68").text.includes("yurplatform.ru") && Pro.mark("d68").size === 16);
    assert.equal(Pro.mark("d01"), null);
    Pro.active = true; assert.equal(Pro.mark("d68"), null);
    const h = (tag, attrs, ...kids) => ({ tag, attrs, kids });
    assert.equal(Pro.thanksBlock(h, "d01"), null); // ссылка на оплату ещё не задана
    Pro.CONFIG.SUPPORT_URL = "https://pay.example/";
    assert(Pro.thanksBlock(h, "d01") && Pro.thanksBlock(h, "k1", true).kids[0].kids[0].includes("вернуть эти деньги"));
    ["d38", "d66", "d84", "d89", "k16", "d37", "d93", "d100", "m01"].forEach(id => assert.equal(Pro.thanksBlock(h, id), null, id));
  });

  await t("логотип: в .docx появляются картинка, связь и тип содержимого; без логотипа файл прежний", async () => {
    const { Pro, Docx } = loadPro();
    const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
    Pro.logo.set({ data: "data:image/png;base64," + Buffer.from(png).toString("base64"), w: 600, h: 200 });
    const lb = Pro.logo.bytes();
    assert(lb && lb.ext === "png" && Buffer.from(lb.bytes).equals(Buffer.from(png)));
    assert.equal(Pro.docxOptions("d68").logo, undefined); // без тарифа логотипа нет
    Pro.active = true;
    const zip = Buffer.from(Docx.buildDocx([{ text: "Договор" }], Pro.docxOptions("d68"))).toString("latin1");
    assert(zip.includes("word/media/logo.png") && zip.includes('Extension="png"') && zip.includes('r:embed="rIdLogo"') && zip.includes("relationships/image"));
    assert(zip.includes('cx="1620000"')); // 600×200 px → по ширине 4,5 см
    assert(!Buffer.from(Docx.buildDocx([{ text: "Договор" }], Pro.docxOptions("d01"))).toString("latin1").includes("logo"));
    fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, "out", "logo.docx"), Docx.buildDocx([{ text: "Договор с логотипом" }], Pro.docxOptions("d68")));
  });

  console.log(`\n${n} проверок пройдено`);
})().catch(e => { console.error(e); process.exit(1); });
