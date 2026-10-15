/*
 * Подсказки при вводе: адреса, суды, банки, организации — как на хороших сайтах, чтобы не ошибиться в адресе и реквизитах.
 * Источник — DaData (suggestions.dadata.ru, API подсказок, бесплатно до 10 000 запросов в день, ключ для подсказок
 * можно использовать в браузере). Пока TOKEN пустой — в сеть ничего не уходит, работают только проверки без сети.
 *
 * Что уходит в DaData: только текст, который человек вводит в поле адреса, суда или банка, и ИНН организации
 * (10 цифр). ФИО, паспорт, ИНН граждан не отправляются никогда. Человек может выключить подсказки — выбор
 * хранится в этом браузере.
 *
 * Поле получает подсказки автоматически по id и подписи (classify) или явно: question.suggest = "address" | "court" |
 * "bank" | "bik" | "party" | false.
 */
(function (global) {
  "use strict";

  // Ключ API из личного кабинета dadata.ru (раздел «API-ключи», ключ для подсказок; секретный ключ сюда НЕ вставлять)
  const TOKEN = "";
  const URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/";
  const KEY = "yp-suggest";

  const S = {
    token: TOKEN,
    // fetch можно подменить в тестах
    fetch: (...x) => global.fetch(...x),
    cache: new Map(),

    enabled() {
      if (!S.token) return false;
      try { return global.localStorage.getItem(KEY) !== "off"; } catch (e) { return true; }
    },
    setEnabled(on) { try { global.localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { /* без хранилища — до перезагрузки */ } },

    // ---------- что за поле ----------
    classify(q, label) {
      if (q.suggest === false) return null;
      if (typeof q.suggest === "string") return q.suggest;
      if (q.type && q.type !== "text") return null;
      const id = q.id, l = String(label || "").toLowerCase();
      if (/(^|_)inn$/.test(id) && !/^buyer_/.test(id)) return "party";
      if (/(^|_)bik$/.test(id)) return "bik";
      if (/^(court|court_name|basis_court)$|_court$/.test(id) && /суд/.test(l)) return "court";
      if (/^(bank|bank_name)$|_bank$/.test(id) && /банк/.test(l)) return "bank";
      if (/address/.test(id) && /адрес/.test(l)) return "address";
      return null;
    },

    // соседние поля, которые можно заполнить по выбранной подсказке: { поле: значение }
    siblings(kind, id, item, has) {
      const out = {};
      const put = (k, v) => { if (v && has(k)) out[k] = v; };
      const d = item.data || {};
      if (kind === "court") {
        const addr = d.address || d.legal_address;
        put(id + "_address", addr);
        if (id === "court_name") put("court_address", addr);
      }
      if (kind === "bank" || kind === "bik") {
        const base = kind === "bank" ? id.replace(/_?(bank|bank_name)$/, "") : id.replace(/_?bik$/, "");
        const p = base ? base + "_" : "";
        const name = d.name && (d.name.payment || d.name.short) || item.value;
        put(p + "bik", d.bic);
        put(p + "bank", name);
        put(p + "corr", d.correspondent_account);
        put(p + "bank_address", d.address && S.formatAddress(d.address.value));
        if (kind === "bank") put(id + "_address", d.address && S.formatAddress(d.address.value));
      }
      if (kind === "party") {
        const p = id.replace(/inn$/, "");
        put(p + "inn", d.inn);
        put(p + "name", d.name && d.name.short_with_opf || item.value);
        put(p + "ogrn", d.ogrn);
        put(p + "kpp", d.type === "LEGAL" ? d.kpp : null);
        put(p + "address", d.address && S.formatAddress(d.address.unrestricted_value || d.address.value));
        if (d.management) { put(p + "head", d.management.name); put(p + "head_pos", d.management.post && d.management.post[0] + d.management.post.slice(1).toLowerCase()); }
        put(p + "kind", d.type === "INDIVIDUAL" ? "ip" : d.type === "LEGAL" ? "org" : null);
      }
      return out;
    },

    // ---------- запрос ----------
    // для организаций уходит только ИНН из 10 цифр (организация) или 12 цифр, если в анкете выбран ИП
    queryAllowed(kind, text, ctx) {
      const t = String(text || "").trim();
      if (kind === "party") {
        if (/^\d{10}$/.test(t)) return true;
        return /^\d{12}$/.test(t) && !!ctx && ctx.ip === true;
      }
      if (kind === "bik") return /^\d{6,9}$/.test(t);
      return t.length >= 3;
    },
    endpoint(kind) { return { address: "address", court: "court", bank: "bank", bik: "bank", party: "party" }[kind]; },

    async query(kind, text) {
      const ep = S.endpoint(kind);
      const key = ep + "|" + text;
      if (S.cache.has(key)) return S.cache.get(key);
      const body = { query: String(text).slice(0, 300), count: kind === "party" ? 5 : 7 };
      const res = await S.fetch(URL + ep, { method: "POST", mode: "cors", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Token " + S.token }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("suggest " + res.status);
      const json = await res.json();
      const list = (json.suggestions || []).slice(0, body.count);
      S.cache.set(key, list);
      if (S.cache.size > 200) S.cache.delete(S.cache.keys().next().value);
      return list;
    },

    // ---------- текст для документа ----------
    // DaData пишет «г Москва, ул Ленина, д 5» — в документах принято с точками
    formatAddress(s) {
      if (!s) return s;
      // сокращения через дефис (р-н, пр-кт, б-р, ст-ца) пишутся без точки
      const ABBR = "г|ул|д|кв|обл|р-н|пер|пл|ш|наб|пр-кт|б-р|к|корп|стр|пом|ком|мкр|пгт|рп|с|п|х|ст-ца|тер|влд|снт|просп|туп|пр|зд|соор|двлд|оф";
      return String(s).replace(new RegExp(`(^|[\\s,])(${ABBR})(?=[\\s,]|$)`, "g"), (m, pre, ab) => ab.includes("-") ? m : `${pre}${ab}.`).replace(/\s{2,}/g, " ").trim();
    },
    addressText(item) {
      const d = item.data || {};
      return S.formatAddress(item.unrestricted_value || (d.postal_code ? d.postal_code + ", " + item.value : item.value));
    },
    // адрес выбран не до дома — продолжаем подсказывать (как на хороших сайтах)
    addressPartial(item) {
      const d = item.data || {};
      return !d.house && !d.stead && Number(d.fias_level || 0) < 8;
    },
    label(kind, item) {
      const d = item.data || {};
      if (kind === "party") return { main: item.value, sub: [d.inn && "ИНН " + d.inn, d.address && d.address.value, d.state && d.state.status && d.state.status !== "ACTIVE" ? "⚠ " + S.status(d.state.status) : null].filter(Boolean).join(" · ") };
      if (kind === "bank" || kind === "bik") return { main: item.value, sub: [d.bic && "БИК " + d.bic, d.address && d.address.value].filter(Boolean).join(" · ") };
      if (kind === "court") return { main: item.value, sub: d.address || "" };
      return { main: S.formatAddress(item.value), sub: d.postal_code ? "индекс " + d.postal_code : "" };
    },
    status(s) { return { LIQUIDATING: "ликвидируется", LIQUIDATED: "ликвидирована", BANKRUPT: "банкротство", REORGANIZING: "реорганизация" }[s] || "не действует"; },

    // ---------- проверки без сети ----------
    // мягкая подсказка под полем после ввода, без запросов
    offlineHint(kind, value) {
      const v = String(value || "").trim();
      if (!v) return null;
      if (kind === "address") {
        if (!/\d/.test(v)) return "Похоже, не указан номер дома";
        if (v.length < 10) return "Адрес выглядит слишком коротким — укажите город, улицу, дом и квартиру";
      }
      if (kind === "party" && /^\d+$/.test(v) && v.length !== 10 && v.length !== 12) return "ИНН организации — 10 цифр, предпринимателя — 12";
      if (kind === "bik" && /^\d+$/.test(v) && v.length === 9 && !/^04/.test(v)) return "БИК российских банков начинается с 04 — проверьте";
      return null;
    },

    // ---------- выпадающий список ----------
    // ctx: { kind, q, getA, has(id), apply(values, final), ip }
    attach(input, ctx, h) {
      const { kind } = ctx;
      const wrap = h("div", { class: "sg" });
      const list = h("ul", { class: "sg-list", role: "listbox", id: input.id + "-sg", hidden: true });
      input.setAttribute("role", "combobox");
      input.setAttribute("aria-autocomplete", "list");
      input.setAttribute("aria-controls", list.id);
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("autocomplete", "off");
      let items = [], cur = -1, timer = null, seq = 0;
      const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); cur = -1; input.removeAttribute("aria-activedescendant"); };
      const pick = i => {
        const it = items[i];
        if (!it) return;
        if (kind === "address") {
          const text = S.addressText(it);
          if (S.addressPartial(it)) { input.value = S.formatAddress(it.value) + " "; ctx.apply({ [ctx.q.id]: input.value }, false); close(); input.focus(); run(); return; }
          input.value = text;
          ctx.apply({ [ctx.q.id]: text }, true);
        } else {
          const own = kind === "party" ? (it.data && it.data.inn) : kind === "bik" ? (it.data && it.data.bic) : it.value;
          const vals = Object.assign({ [ctx.q.id]: own }, S.siblings(kind, ctx.q.id, it, ctx.has));
          input.value = own;
          ctx.apply(vals, true, it);
        }
        close();
      };
      const render = () => {
        list.textContent = "";
        if (!items.length) { close(); return; }
        items.forEach((it, i) => {
          const lb = S.label(kind, it);
          const li = h("li", { role: "option", id: `${input.id}-sg-${i}`, class: i === cur ? "on" : "", "aria-selected": i === cur ? "true" : "false",
            onmousedown: e => { e.preventDefault(); pick(i); } }, h("span", { class: "sg-m" }, lb.main), lb.sub ? h("span", { class: "sg-s" }, lb.sub) : null);
          list.appendChild(li);
        });
        list.appendChild(h("li", { class: "sg-foot", "aria-hidden": "true" },
          h("a", { href: "https://dadata.ru/", target: "_blank", rel: "noopener noreferrer", tabindex: "-1" }, "Подсказки DaData"),
          h("button", { type: "button", class: "sg-off", tabindex: "-1", onmousedown: e => { e.preventDefault(); S.setEnabled(false); close(); if (ctx.onToggle) ctx.onToggle(); } }, "выключить")));
        list.hidden = false;
        input.setAttribute("aria-expanded", "true");
        if (cur >= 0) input.setAttribute("aria-activedescendant", `${input.id}-sg-${cur}`); else input.removeAttribute("aria-activedescendant");
      };
      const run = () => {
        clearTimeout(timer);
        const text = input.value;
        if (!S.enabled() || !S.queryAllowed(kind, text, ctx)) { items = []; close(); return; }
        timer = setTimeout(async () => {
          const my = ++seq;
          try {
            const res = await S.query(kind, text.trim());
            if (my !== seq || document.activeElement !== input) return;
            items = res; cur = -1; render();
          } catch (e) { items = []; close(); }
        }, 250);
      };
      input.addEventListener("input", run);
      input.addEventListener("blur", () => setTimeout(close, 150));
      input.addEventListener("keydown", e => {
        if (list.hidden || !items.length) return;
        if (e.key === "ArrowDown") { e.preventDefault(); cur = (cur + 1) % items.length; render(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); cur = (cur - 1 + items.length) % items.length; render(); }
        else if (e.key === "Enter" && cur >= 0) { e.preventDefault(); pick(cur); }
        else if (e.key === "Escape") { close(); }
      });
      wrap.appendChild(input);
      wrap.appendChild(list);
      return wrap;
    },
  };

  global.Suggest = S;
})(typeof window !== "undefined" ? window : globalThis);
