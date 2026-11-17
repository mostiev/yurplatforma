/*
 * Деньги без третьих лиц: кнопка «Сказать спасибо» и тариф «Бизнес».
 * Всё работает в браузере. Ответы анкет никуда не уходят. Ключ тарифа проверяется подписью (ECDSA P-256)
 * прямо в браузере — сервер не нужен. Ключи выпускает владелец: node tools/pro-keys.js issue "имя или почта" 30
 *
 * Что даёт «Бизнес» (только для документов разделов «Малый бизнес» и «Самозанятые»):
 *  — без строки «Составлено на yurplatform.ru» в конце файла;
 *  — логотип в начале документа;
 *  — сколько угодно своих компаний и контрагентов (бесплатно — одна запись).
 */
(function (global) {
  "use strict";

  // ===== Настройки владельца =====
  const CONFIG = {
    SUPPORT_URL: "",      // ссылка на оплату «Сказать спасибо» (ЮKassa: платёжная ссылка с суммой на выбор). Пусто — кнопка не показывается
    BUY_MONTH_URL: "",    // ссылка на оплату тарифа на месяц
    BUY_YEAR_URL: "",     // ссылка на оплату тарифа на год
    PRICE_MONTH: 490,
    PRICE_YEAR: 3900,
    CONTACT: "",          // куда писать, если ключ не пришёл (почта проекта)
    SITE: "yurplatform.ru",
  };
  // открытый ключ для проверки подписи; записывается командой node tools/pro-keys.js init
  const PUBLIC_JWK = {"kty":"EC","crv":"P-256","x":"-A3dRMPnTXj2lakArs49Hm6dH_1NebavLkbe511lzG4","y":"--FDAr3FsIH58EfoaTpmioFR47Q4HllwHOqhcrTCh7g"}; // pro-keys:public

  // документы, к которым относится тариф (разделы «Малый бизнес» и «Самозанятые»)
  const BIZ = ["d29", "d30", "d31", "d32", "d68", "d69", "d70", "d71", "d72", "d73", "d74", "d75", "d76", "d77", "d78", "d79", "d80"];
  // где не просим денег: долги и приставы, мигранты, наследство (смерть близкого), СВО, мошенники, банкротство
  const NO_ASK = ["d37", "d38", "d39", "d40", "d41", "d42", "d43", "d61", "d66", "d84", "d87", "d88", "d89", "d93", "d100",
    "k5", "k8", "k16", "m01", "m02", "m03", "m04", "m05"];
  // калькуляторы, которые показывают, сколько человеку должны или вернут
  const GAIN = ["k1", "k2", "k3", "k4", "k6", "k9", "k10", "k11", "k12", "k19"];

  const LS = {
    get(k) { try { const v = global.localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { global.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { global.localStorage.removeItem(k); } catch (e) { /* ничего */ } },
  };
  const KEY = "yp-pro", COMPANIES = "yp-companies", LOGO = "yp-logo";
  const FREE_LIMIT = 1;

  // ===== Ключ =====
  const b64u = {
    enc(bytes) { let s = ""; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
    dec(str) { const s = atob(String(str).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(str).length + 3) % 4)); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; },
  };
  const utf8 = { enc: s => new TextEncoder().encode(s), dec: b => new TextDecoder().decode(b) };

  // ключ: YP-<данные>.<подпись>; данные — JSON { n: кому, e: "ГГГГ-ММ-ДД" — действует по этот день, i: дата выпуска }
  async function verify(key, jwk) {
    const pub = jwk || Pro.PUBLIC_JWK;
    const m = /^YP-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(key || "").trim());
    if (!m) return { ok: false, why: "Ключ выглядит не так: он начинается с «YP-»." };
    if (!pub) return { ok: false, why: "Проверка ключей ещё не настроена." };
    const subtle = global.crypto && global.crypto.subtle;
    if (!subtle) return { ok: false, why: "Браузер не умеет проверять ключ. Откройте сайт по адресу https://." };
    let data;
    try { data = JSON.parse(utf8.dec(b64u.dec(m[1]))); } catch (e) { return { ok: false, why: "Ключ повреждён — скопируйте его целиком." }; }
    try {
      const k = await subtle.importKey("jwk", pub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      const good = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, b64u.dec(m[2]), utf8.enc(m[1]));
      if (!good) return { ok: false, why: "Ключ не подходит — проверьте, что скопировали его целиком." };
    } catch (e) { return { ok: false, why: "Ключ повреждён — скопируйте его целиком." }; }
    const exp = data.e && /^\d{4}-\d{2}-\d{2}$/.test(data.e) ? new Date(data.e + "T23:59:59") : null;
    if (!exp) return { ok: false, why: "В ключе нет срока действия." };
    if (exp < new Date()) return { ok: false, expired: true, exp, name: data.n, why: `Срок ключа закончился ${fmt(exp)}.` };
    return { ok: true, exp, name: data.n || "" };
  }
  function fmt(d) { return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`; }

  // ===== Компании и контрагенты =====
  // запись: { id, role: "mine"|"other", kind: "org"|"ip"|"self"|"person", name, inn, ogrn, kpp, address, head_pos, head, basis, email, phone, bank, account, bik, corr }
  const FIELDS = ["name", "inn", "ogrn", "kpp", "address", "head_pos", "head", "basis", "email", "phone", "bank", "account", "bik", "corr", "passport"];
  const companies = {
    list() { const v = LS.get(COMPANIES); return Array.isArray(v) ? v : []; },
    canAdd() { return Pro.active || companies.list().length < FREE_LIMIT; },
    save(c) {
      const all = companies.list();
      const i = all.findIndex(x => x.id === c.id);
      if (i < 0 && !companies.canAdd()) return false;
      const rec = Object.assign({ id: c.id || "c" + Date.now().toString(36) }, c);
      if (i >= 0) all[i] = rec; else all.push(rec);
      return LS.set(COMPANIES, all) ? rec : false;
    },
    remove(id) { LS.set(COMPANIES, companies.list().filter(x => x.id !== id)); },
    clear() { LS.del(COMPANIES); },
    // запись → ответы анкеты для стороны с префиксом p (C.bizParty) или исполнителя-самозанятого / заказчика (ex_, cl_)
    toAnswers(c, p, mode) {
      const a = {};
      if (mode === "freelancer") { ["name", "inn", "address", "phone", "email", "bank", "account", "bik", "corr"].forEach(f => { if (c[f]) a["ex_" + f] = c[f]; }); return a; }
      if (mode === "client") {
        a.cl_type = c.kind === "person" || c.kind === "self" ? "person" : "org";
        a.cl_name = c.kind === "ip" ? "ИП " + c.name : c.name;
        if (c.inn) a.cl_inn = c.inn; if (c.ogrn) a.cl_ogrn = c.ogrn; if (c.address) a.cl_address = c.address;
        if (c.kind === "org" && (c.head_pos || c.head)) a.cl_signer = [c.head_pos, c.head].filter(Boolean).join(" ");
        return a;
      }
      a[p + "_kind"] = c.kind === "self" ? "person" : c.kind;
      FIELDS.forEach(f => { if (c[f]) a[p + "_" + f] = c[f]; });
      return a;
    },
    // ответы анкеты → запись
    fromAnswers(a, p, mode) {
      if (mode === "freelancer") return { kind: "self", name: a.ex_name, inn: a.ex_inn, address: a.ex_address, phone: a.ex_phone, email: a.ex_email, bank: a.ex_bank, account: a.ex_account, bik: a.ex_bik, corr: a.ex_corr };
      if (mode === "client") return { kind: a.cl_type === "person" ? "person" : String(a.cl_inn || "").length === 12 ? "ip" : "org", name: String(a.cl_name || "").replace(/^ИП\s+/, ""), inn: a.cl_inn, ogrn: a.cl_ogrn, address: a.cl_address };
      const c = { kind: a[p + "_kind"] || "org" };
      FIELDS.forEach(f => { if (a[p + "_" + f]) c[f] = a[p + "_" + f]; });
      return c;
    },
    label(c) { return (c.kind === "ip" ? "ИП " : "") + (c.name || "без названия") + (c.inn ? `, ИНН ${c.inn}` : ""); },
  };

  // стороны в анкете: C.bizParty — вопрос «<p>_kind» с вариантами org/ip; самозанятый — ex_name + ex_inn; заказчик — cl_type
  function parties(spec) {
    const out = [];
    spec.steps.forEach(step => step.questions.forEach(q => {
      const m = /^([a-z]+)_kind$/.exec(q.id);
      if (m && !out.some(x => x.p === m[1]) && q.options && q.options.some(o => o.value === "org") && q.options.some(o => o.value === "ip")) {
        out.push({ p: m[1], mode: "biz", step, role: String(typeof q.label === "string" ? q.label : m[1]).replace(/\s+—\s+это\s*$/, "") });
      }
    }));
    const ids = new Set(spec.steps.flatMap(s => s.questions.map(q => q.id)));
    if (ids.has("ex_name") && ids.has("ex_inn") && !out.some(x => x.p === "ex")) out.push({ p: "ex", mode: "freelancer", step: spec.steps.find(s => s.questions.some(q => q.id === "ex_name")), role: "Исполнитель (вы)" });
    if (ids.has("cl_type") && ids.has("cl_name") && !out.some(x => x.p === "cl")) out.push({ p: "cl", mode: "client", step: spec.steps.find(s => s.questions.some(q => q.id === "cl_name")), role: "Заказчик" });
    return out;
  }

  // ===== Логотип =====
  const logo = {
    get() { return LS.get(LOGO); }, // { data: "data:image/png;base64,…", w, h }
    set(v) { return LS.set(LOGO, v); },
    clear() { LS.del(LOGO); },
    bytes() {
      const l = logo.get();
      const m = l && /^data:image\/(png|jpeg);base64,(.+)$/.exec(l.data || "");
      if (!m) return null;
      return { ext: m[1] === "jpeg" ? "jpeg" : "png", bytes: b64u.dec(m[2].replace(/\+/g, "-").replace(/\//g, "_")), w: l.w || 300, h: l.h || 100 };
    },
  };

  // ===== Что добавляется в файл =====
  function isBiz(id) { return BIZ.includes(id); }
  function mark(id) {
    if (!isBiz(id) || Pro.active) return null;
    return { text: `Составлено на ${CONFIG.SITE} — бесплатный конструктор документов`, align: "left", size: 16, before: 360 };
  }
  // параметры buildDocx для файла: логотип — только в тарифе и только для бизнес-документов
  function docxOptions(id) { return isBiz(id) && Pro.active ? { logo: logo.bytes() } : {}; }

  // ===== «Сказать спасибо» =====
  function thanksBlock(h, id, gain) {
    if (!CONFIG.SUPPORT_URL || NO_ASK.includes(id)) return null;
    const text = gain && GAIN.includes(id)
      ? "Если получится вернуть эти деньги — поддержите проект. Сайт бесплатный, без рекламы и без регистрации."
      : "Помогло? Сайт бесплатный, без рекламы и без регистрации — его можно поддержать любой суммой.";
    return h("div", { class: "thanks" }, h("p", {}, text),
      h("a", { class: "btn ghost sm", href: CONFIG.SUPPORT_URL, target: "_blank", rel: "noopener noreferrer" }, "Сказать спасибо"));
  }

  const Pro = {
    CONFIG, PUBLIC_JWK, BIZ, NO_ASK, GAIN, FREE_LIMIT,
    active: false, info: null,
    verify, companies, parties, logo, isBiz, mark, docxOptions, thanksBlock,
    // включить тариф: проверяем ключ и запоминаем его в браузере
    async activate(key) {
      const r = await verify(key);
      if (r.ok) { LS.set(KEY, { key: String(key).trim() }); Pro.active = true; Pro.info = r; }
      return r;
    },
    deactivate() { LS.del(KEY); Pro.active = false; Pro.info = null; },
    // при загрузке страницы — перепроверяем сохранённый ключ (подделать флаг в браузере нельзя: проверяется подпись)
    ready: null,
    b64u,
  };
  Pro.recheck = async () => {
    const saved = LS.get(KEY);
    if (!saved || !saved.key) { Pro.active = false; return false; }
    const r = await verify(saved.key);
    Pro.active = !!r.ok; Pro.info = r;
    return Pro.active;
  };
  Pro.ready = Pro.recheck().catch(() => false);

  global.Pro = Pro;
})(typeof window !== "undefined" ? window : globalThis);
