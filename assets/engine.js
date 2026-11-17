/*
 * Движок документов.
 * Каждый документ описан спецификацией в content/<id>.js (см. content/README.md).
 * Движок рисует анкету по шагам, показывает живой предпросмотр
 * и собирает .docx прямо в браузере. На сервер ничего не отправляется — кроме текста полей адреса, суда, банка
 * и ИНН организации для подсказок (assets/suggest.js), если подсказки подключены и не выключены.
 */
(function (global) {
  "use strict";

  // ---------- Утилиты для спецификаций ----------
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  // календарь .ics: события на весь день с напоминанием накануне в 9:00. Файл создаётся в браузере
  function icsText(events) {
    const pad = n => String(n).padStart(2, "0");
    const day = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const esc = s => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
    // строки не длиннее 75 байт (RFC 5545), перенос — CRLF + пробел
    const fold = line => {
      const enc = new TextEncoder(); const out = []; let cur = "", len = 0;
      for (const ch of line) { const b = enc.encode(ch).length; if (len + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; len = 0; } cur += ch; len += b; }
      out.push(cur); return out.join("\r\n ");
    };
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//yurplatforma//RU", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    events.forEach((e, i) => {
      const next = new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate() + 1);
      lines.push("BEGIN:VEVENT", `UID:${day(e.date)}-${i}-${Math.random().toString(36).slice(2, 10)}@yurplatforma`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day(e.date)}`, `DTEND;VALUE=DATE:${day(next)}`, `SUMMARY:${esc(e.title)}`);
      if (e.text) lines.push(`DESCRIPTION:${esc(e.text)}`);
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-PT15H", `DESCRIPTION:${esc(e.title)}`, "END:VALARM", "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  const U = {
    // ответы в ссылке (после «#» — на сервер не уходит): JSON → UTF-8 → base64url
    packAnswers(a) {
      const bytes = new TextEncoder().encode(JSON.stringify(a));
      let bin = ""; bytes.forEach(b => { bin += String.fromCharCode(b); });
      return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    },
    unpackAnswers(s) {
      try {
        const bin = atob(String(s).replace(/-/g, "+").replace(/_/g, "/"));
        const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
        const v = JSON.parse(new TextDecoder().decode(bytes));
        return v && typeof v === "object" && !Array.isArray(v) ? v : null;
      } catch (e) { return null; }
    },
    // опись вложения (ф. 107) по документу: сам документ + строки из «Приложения:»; адрес и ценность — от руки
    opis(ps, title) {
      const att = [];
      ps.forEach(p => { if (p && typeof p.text === "string" && /^Приложения:\n/.test(p.text)) p.text.split("\n").slice(1).forEach(l => { const t = l.replace(/^\d+\.\s*/, "").replace(/\.$/, "").trim(); if (t) att.push(t); }); });
      const items = [String(title || "Документ").replace(/\.$/, ""), ...att];
      const P = [];
      const copy = () => {
        P.push({ text: "ф. 107", align: "right", after: 120 });
        P.push({ text: "ОПИСЬ ВЛОЖЕНИЯ", align: "center", bold: true, after: 0 });
        P.push({ text: "в ценное письмо", align: "center", after: 240 });
        P.push({ text: "Куда: ________________________________________________________________", align: "left", after: 120 });
        P.push({ text: "Кому: ________________________________________________________________", align: "left", after: 240 });
        P.push({ table: { widths: [700, 5655, 1400, 1600], head: 1, rows: [
          ["№ п/п", "Наименование предметов", "Количество предметов", "Объявленная ценность, руб."],
          ...items.map((x, i) => [String(i + 1), x, "1", ""]),
          ["", "Общий итог", String(items.length), ""],
        ] } });
        P.push({ text: "Отправитель ____________________ (подпись)", align: "left", before: 240, after: 120 });
        P.push({ text: "Проверил ____________________ (подпись работника связи)", align: "left", after: 0 });
      };
      copy(); P.push({ pageBreak: true }); copy();
      return P;
    },
    icsText,
    // только будущие события (сегодня включительно), по дате
    upcoming(events) {
      const t = U.today();
      return (events || []).filter(e => e && e.date && e.date >= t).sort((x, y) => x.date - y.date);
    },
    saveFile(content, name, type) {
      const url = URL.createObjectURL(new Blob([content], { type }));
      const link = document.createElement("a"); link.href = url; link.download = String(name).replace(/[\\/:*?"<>|]+/g, " -").replace(/\s+/g, " ").trim();
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
    // блок «Сроки» с кнопкой «Добавить в календарь»; h — функция создания элементов
    remindersBlock(h, events, fileName) {
      const ev = U.upcoming(events);
      if (!ev.length) return null;
      return h("div", { class: "reminders" },
        h("h3", {}, "Сроки"),
        h("ul", {}, ev.slice(0, ev.length > 4 ? 3 : 4).map(e => h("li", {}, h("strong", {}, U.fmtDate(e.date)), " — ", e.title)), ev.length > 4 ? h("li", {}, `и ещё ${ev.length - 3} — все попадут в календарь`) : null),
        h("button", { class: "btn ghost", type: "button", onclick: () => U.saveFile(icsText(ev), (fileName || "Сроки") + ".ics", "text/calendar;charset=utf-8") }, "Добавить в календарь"),
        h("p", { class: "field-h" }, "Скачается файл .ics — откройте его, и сроки появятся в календаре телефона или компьютера с напоминанием накануне."));
    },
    // поле-таблица: только строки, где хоть что-то заполнено
    rows(v) {
      return (Array.isArray(v) ? v : []).filter(r => r && typeof r === "object" && Object.values(r).some(x => x !== undefined && x !== null && String(x).trim() !== ""));
    },
    // дата "YYYY-MM-DD" → Date (полночь по местному времени)
    date(s) {
      if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.getFullYear() === y && dt.getMonth() === m - 1 ? dt : null;
    },
    today() { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); },
    iso(dt) { return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`; },
    addDays(dt, n) { const r = new Date(dt); r.setDate(r.getDate() + n); return r; },
    addMonths(dt, n) {
      const r = new Date(dt.getFullYear(), dt.getMonth() + n, 1);
      const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
      r.setDate(Math.min(dt.getDate(), last));
      return r;
    },
    daysBetween(a, b) { return Math.round((b - a) / 864e5); },
    fmtDate(dt) { return dt ? `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}` : ""; },
    fmtDateLong(dt) { return dt ? `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()} г.` : ""; },
    money(n) {
      if (n == null || n === "" || isNaN(n)) return "";
      const v = Math.round(Number(n) * 100) / 100;
      const [i, f] = v.toFixed(2).split(".");
      return i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (f === "00" ? "" : "," + f);
    },
    // "Иванов Иван Иванович" → "Иванов И. И."
    shortName(full) {
      const p = String(full || "").trim().split(/\s+/);
      if (p.length < 2) return p[0] || "";
      return p[0] + " " + p.slice(1).map(x => x[0].toUpperCase() + ".").join(" ");
    },
    // значение или видимая заглушка для предпросмотра
    F(value, label) {
      return value === undefined || value === null || value === "" ? `⟨${label}⟩` : String(value);
    },
  };

  // ---------- Модель ----------
  function visibleQuestions(spec, step, a, d) {
    return step.questions.filter(q => !q.show || q.show(a, d));
  }

  function optionState(q, opt, a, d) {
    return opt.disabled ? opt.disabled(a, d) : null; // строка-причина или null
  }

  function validateQuestion(q, a, d) {
    const v = q.type === "rows" ? U.rows(a[q.id]) : a[q.id];
    const required = typeof q.required === "function" ? !!q.required(a, d) : q.required !== false;
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);
    if (empty) return required ? "Заполните это поле" : null;
    if (q.type === "date" && !U.date(v)) return "Укажите дату";
    if ((q.type === "money" || q.type === "number") && (isNaN(v) || Number(v) < (q.min ?? 0))) return "Укажите число";
    if (q.type === "rows") {
      for (let i = 0; i < v.length; i++) for (const c of q.columns) {
        const x = v[i][c.id];
        if (c.required && (x === undefined || x === null || String(x).trim() === "")) return `Заполните «${c.label}» в строке ${i + 1}`;
        if (c.type === "number" && x !== undefined && x !== "" && (isNaN(x) || Number(x) < 0)) return `«${c.label}» в строке ${i + 1} — число`;
        if (c.type === "date" && x && !U.date(x)) return `«${c.label}» в строке ${i + 1} — дата`;
      }
      if (q.max && v.length > q.max) return `Не больше ${q.max} строк`;
    } else if (q.type === "multi") {
      if (!Array.isArray(v) || v.some(x => !q.options.find(o => o.value === x))) return "Выберите варианты";
    } else if (q.options) {
      const opt = q.options.find(o => o.value === v);
      if (!opt) return "Выберите вариант";
      if (optionState(q, opt, a, d)) return "Этот вариант недоступен в вашей ситуации";
    }
    if (q.validate) return q.validate(v, a, d) || null;
    return null;
  }

  function stepErrors(spec, step, a) {
    const d = spec.derive(a);
    const errs = {};
    for (const q of visibleQuestions(spec, step, a, d)) {
      const e = validateQuestion(q, a, d);
      if (e) errs[q.id] = e;
    }
    return errs;
  }

  // Убираем ответы на вопросы, которые стали скрытыми, и недоступные варианты
  function prune(spec, a) {
    let changed = true, guard = 0;
    while (changed && guard++ < 5) {
      changed = false;
      const d = spec.derive(a);
      // один id может быть у нескольких вопросов (разные формулировки для разных веток):
      // ответ удаляем, только если не виден ни один из них
      const visibleIds = new Set();
      for (const step of spec.steps) for (const q of step.questions) if (!q.show || q.show(a, d)) visibleIds.add(q.id);
      for (const step of spec.steps) {
        for (const q of step.questions) {
          const hidden = !visibleIds.has(q.id);
          const opt = q.options && a[q.id] !== undefined ? q.options.find(o => o.value === a[q.id]) : null;
          const badOpt = opt && optionState(q, opt, a, d);
          if ((hidden || badOpt) && a[q.id] !== undefined) { delete a[q.id]; changed = true; }
        }
      }
    }
    return a;
  }

  // ---------- Текст ----------
  function paragraphsToText(ps) {
    return ps.map(p => p.pageBreak ? "————" : p.table ? p.table.rows.map(r => r.map(c => c && typeof c === "object" ? c.text : c).join(" | ")).join("\n") : p.text).join("\n\n");
  }

  // ---------- Интерфейс ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  }

  // append с раскрытием массивов и пропуском пустых значений
  function add(el, ...kids) {
    for (const k of kids.flat(3)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
    return el;
  }

  function mount(root, spec) {
    // spec.defaults — ответы, заданные заранее (например, вариант документа для отдельной страницы каталога)
    const state = { a: Object.assign({}, spec.defaults || {}), step: 0, touched: {}, done: false, notes: {} };
    const allIds = new Set(spec.steps.flatMap(s => s.questions.map(q => q.id)));
    const SG = global.Suggest || null;
    // данные из калькулятора (assets/calc.js → sessionStorage, живут 30 минут и только в этой вкладке)
    try {
      const raw = global.sessionStorage && global.sessionStorage.getItem("yp-prefill");
      const p = raw ? JSON.parse(raw) : null;
      if (p && p.to === spec.id && Date.now() - p.at < 30 * 60 * 1000) {
        const got = Object.keys(p.a || {}).filter(k => allIds.has(k));
        got.forEach(k => { state.a[k] = p.a[k]; });
        if (got.length) { prune(spec, state.a); state.prefill = { from: p.from, ids: got.filter(k => k in state.a) }; }
      }
      if (p) global.sessionStorage.removeItem("yp-prefill");
    } catch (e) { /* нет хранилища — начинаем с пустой анкеты */ }

    // Черновик и «Мои данные» — только в этом браузере (localStorage), на сервер не уходят
    const LS = {
      get(k) { try { const v = global.localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
      set(k, v) { try { global.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } },
      del(k) { try { global.localStorage.removeItem(k); } catch (e) { /* ничего */ } },
    };
    const DRAFT = "yp-draft:" + spec.id, PROFILE = "yp-profile";
    const PROFILE_KEYS = ["buyer_name", "buyer_birth", "buyer_address", "buyer_phone", "buyer_email"];
    // черновик по ссылке: #a=… (в адресе после «#», на сервер не отправляется)
    try {
      const m = String(global.location && global.location.hash || "").match(/^#a=([A-Za-z0-9_-]+)$/);
      const got = m ? U.unpackAnswers(m[1]) : null;
      if (got) {
        Object.keys(got).filter(k => allIds.has(k)).forEach(k => { state.a[k] = got[k]; });
        prune(spec, state.a);
        state.shared = true;
        global.history.replaceState(null, "", global.location.pathname + global.location.search);
      }
    } catch (e) { /* без истории браузера — просто откроем анкету */ }
    if (!state.prefill && !state.shared) {
      const dr = LS.get(DRAFT);
      if (dr && dr.a && Date.now() - dr.at < 60 * 864e5) {
        Object.keys(dr.a).filter(k => allIds.has(k)).forEach(k => { state.a[k] = dr.a[k]; });
        prune(spec, state.a);
        state.step = Math.max(0, Number(dr.step) || 0);
        state.restored = dr.at;
      }
    }
    const prof = state.shared ? null : LS.get(PROFILE);
    if (prof) {
      const used = PROFILE_KEYS.filter(k => allIds.has(k) && prof[k] && (state.a[k] === undefined || state.a[k] === ""));
      used.forEach(k => { state.a[k] = prof[k]; });
      if (used.length) state.profileUsed = true;
    }
    let draftT = null;
    function saveDraft() {
      clearTimeout(draftT);
      draftT = setTimeout(() => {
        const own = Object.keys(state.a).filter(k => !(spec.defaults && JSON.stringify(spec.defaults[k]) === JSON.stringify(state.a[k])));
        if (own.length) LS.set(DRAFT, { a: state.a, step: state.step, at: Date.now() });
      }, 400);
    }
    function startOver() {
      LS.del(DRAFT);
      state.a = Object.assign({}, spec.defaults || {}); state.step = 0; state.done = false; state.touched = {};
      state.restored = null; state.profileUsed = false; state.prefill = null;
      renderForm(true); renderPreview();
    }

    const $form = h("section", { class: "wiz" });
    const $preview = h("section", { class: "preview", "aria-label": "Предпросмотр документа" });
    root.append(h("div", { class: "doc-layout" }, $form, $preview));

    function set(id, value) {
      if (value === "" || value === undefined) delete state.a[id]; else state.a[id] = value;
      prune(spec, state.a);
      renderForm(false);
      renderPreview();
    }

    function field(q, d, errs) {
      const id = "q-" + q.id;
      const v = state.a[q.id];
      const err = state.touched[q.id] ? errs[q.id] : null;
      let control;

      if (q.type === "choice") {
        control = h("div", { class: "choices", role: "radiogroup", "aria-labelledby": id + "-l" },
          q.options.map(opt => {
            const reason = optionState(q, opt, state.a, d);
            return h("label", { class: "choice" + (v === opt.value ? " on" : "") + (reason ? " off" : "") },
              h("input", {
                type: "radio", name: id, value: opt.value, checked: v === opt.value, disabled: !!reason,
                onchange: () => { state.touched[q.id] = true; set(q.id, opt.value); },
              }),
              h("span", { class: "choice-t" }, opt.label),
              opt.hint ? h("span", { class: "choice-h" }, opt.hint) : null,
              reason ? h("span", { class: "choice-r" }, reason) : null);
          }));
      } else if (q.type === "multi") {
        // несколько вариантов: значение — массив
        const cur = Array.isArray(v) ? v : [];
        control = h("div", { class: "choices", role: "group", "aria-labelledby": id + "-l" },
          q.options.map(opt => h("label", { class: "choice" + (cur.includes(opt.value) ? " on" : "") },
            h("input", {
              type: "checkbox", name: id, value: opt.value, checked: cur.includes(opt.value),
              onchange: e => {
                state.touched[q.id] = true;
                const next = e.target.checked ? cur.concat(opt.value) : cur.filter(x => x !== opt.value);
                set(q.id, next.length ? q.options.map(o => o.value).filter(x => next.includes(x)) : undefined);
              },
            }),
            h("span", { class: "choice-t" }, opt.label),
            opt.hint ? h("span", { class: "choice-h" }, opt.hint) : null)));
      } else if (q.type === "select") {
        control = h("select", {
          id, onchange: e => { state.touched[q.id] = true; set(q.id, e.target.value); },
        }, h("option", { value: "" }, "Выберите…"),
          q.options.map(opt => h("option", { value: opt.value, selected: v === opt.value, disabled: !!optionState(q, opt, state.a, d) }, opt.label)));
      } else if (q.type === "rows") {
        // таблица строк: значение — массив объектов { [column.id]: значение }
        const cols = q.columns;
        const shown = Array.isArray(v) && v.length ? v : [{}];
        const live = () => Array.isArray(state.a[q.id]) ? state.a[q.id] : (state.a[q.id] = shown.map(r => Object.assign({}, r)));
        const cellId = (i, c) => `${id}-${i}-${c.id}`;
        const addRow = row => {
          const next = U.rows(state.a[q.id]).concat([row || {}]);
          set(q.id, next);
          const el = document.getElementById(cellId(next.length - 1, cols[row ? Math.min(1, cols.length - 1) : 0]));
          if (el) el.focus();
        };
        const first = cols[0].id;
        const have = new Set(U.rows(v).map(r => String(r[first] || "").trim().toLowerCase()));
        const presets = (q.presets || []).map(p => typeof p === "string" ? { label: p, row: { [first]: p } } : p).filter(p => !have.has(String(p.row[first]).toLowerCase()));
        const canAdd = !q.max || U.rows(v).length < q.max;
        control = h("div", { class: "rows", id, role: "group", "aria-labelledby": id + "-l", style: `--cols: ${cols.map(c => c.w || "1fr").join(" ")}` },
          cols.length > 1 ? h("div", { class: "rows-h", "aria-hidden": "true" }, cols.map(c => h("span", {}, c.label)), h("span")) : null,
          shown.map((row, i) => h("div", { class: "rows-r" + (cols.length > 1 ? "" : " one") },
            cols.map(c => {
              const common = {
                id: cellId(i, c), "aria-label": `${c.label}, строка ${i + 1}`,
                onchange: () => { state.touched[q.id] = true; },
              };
              if (c.type === "select") {
                const sel = h("select", Object.assign(common, { onchange: e => { const arr = live(); arr[i] = Object.assign({}, arr[i], { [c.id]: e.target.value || undefined }); state.touched[q.id] = true; prune(spec, state.a); renderForm(false); renderPreview(); } }),
                  h("option", { value: "" }, c.placeholder || c.label), c.options.map(o => h("option", { value: o.value, selected: row[c.id] === o.value }, o.label)));
                return sel;
              }
              const num = c.type === "number";
              const inp = h("input", Object.assign(common, {
                type: num ? "number" : c.type === "date" ? "date" : "text", inputmode: num ? "decimal" : null, min: num ? 0 : null, step: num ? "any" : null,
                placeholder: c.placeholder || c.label,
                oninput: e => { const arr = live(); const raw = e.target.value; arr[i] = Object.assign({}, arr[i], { [c.id]: raw === "" ? undefined : num ? Number(raw) : raw }); renderPreview(); },
              }));
              inp.value = row[c.id] ?? "";
              // подсказки адресов и в таблицах (например, адреса наследников)
              const ck = SG && !num && c.type !== "date" ? SG.classify({ id: c.id, type: "text", suggest: c.suggest }, c.label) : null;
              if (ck === "address" && SG.enabled()) return SG.attach(inp, { kind: ck, q: { id: c.id }, has: () => false,
                apply: (vals) => { const arr = live(); arr[i] = Object.assign({}, arr[i], { [c.id]: vals[c.id] }); state.touched[q.id] = true; renderPreview(); } }, h);
              return inp;
            }),
            h("button", { type: "button", class: "rows-x", "aria-label": `Удалить строку ${i + 1}`, title: "Удалить строку",
              onclick: () => { const arr = (Array.isArray(state.a[q.id]) ? state.a[q.id] : []).filter((_, j) => j !== i); state.touched[q.id] = true; set(q.id, arr.length ? arr : undefined); } }, "×"))),
          h("div", { class: "rows-add" },
            canAdd ? h("button", { type: "button", class: "btn ghost sm", onclick: () => addRow() }, q.addLabel || "+ Добавить строку") : null,
            canAdd && presets.length ? h("div", { class: "chips" }, h("span", { class: "chips-l" }, "Быстро:"), presets.map(p => h("button", { type: "button", class: "chip", onclick: () => addRow(Object.assign({}, q.presetDefaults || {}, p.row)) }, "+ " + p.label))) : null));
      } else if (q.type === "textarea") {
        control = h("textarea", {
          id, rows: 4, placeholder: (typeof q.placeholder === "function" ? q.placeholder(state.a, d) : q.placeholder) || "",
          oninput: e => { state.a[q.id] = e.target.value; if (!e.target.value) delete state.a[q.id]; renderPreview(); },
          onblur: () => { state.touched[q.id] = true; prune(spec, state.a); soon(); renderPreview(); },
        });
        control.value = v || "";
      } else {
        const type = q.type === "date" ? "date" : (q.type === "money" || q.type === "number") ? "number" : q.type === "email" ? "email" : q.type === "tel" ? "tel" : "text";
        control = h("input", {
          id, type, placeholder: (typeof q.placeholder === "function" ? q.placeholder(state.a, d) : q.placeholder) || "", inputmode: q.type === "money" ? "decimal" : null,
          min: q.type === "money" || q.type === "number" ? (q.min ?? 0) : null, step: q.type === "money" ? "0.01" : q.step || null,
          // по умолчанию дата — прошедшее событие; future: true — можно выбрать будущую дату
          max: q.type === "date" && !q.future ? U.iso(U.today()) : null,
          autocomplete: q.autocomplete || null,
          oninput: e => {
            const raw = e.target.value;
            state.a[q.id] = (q.type === "money" || q.type === "number") && raw !== "" ? Number(raw) : raw;
            if (raw === "") delete state.a[q.id];
            renderPreview();
          },
          onchange: () => { state.touched[q.id] = true; prune(spec, state.a); soon(); renderPreview(); },
        });
        control.value = v ?? "";
      }

      // подсказки адресов, судов, банков, организаций (assets/suggest.js) и проверки без сети
      const labelText = typeof q.label === "function" ? q.label(state.a, d) : q.label;
      const sgKind = SG && control.tagName === "INPUT" && control.type === "text" ? SG.classify(q, labelText) : null;
      let sgExtra = null;
      if (sgKind && SG.enabled()) {
        const pre = q.id.replace(/inn$/, "");
        control = SG.attach(control, {
          kind: sgKind, q, ip: state.a[pre + "kind"] === "ip",
          has: k => allIds.has(k),
          onToggle: () => renderForm(false),
          apply: (vals, final, item) => {
            Object.entries(vals).forEach(([k, x]) => { if (x === undefined || x === null || x === "") return; state.a[k] = x; if (final) state.touched[k] = true; });
            delete state.notes[q.id];
            const st = item && item.data && item.data.state && item.data.state.status;
            if (sgKind === "party" && st && st !== "ACTIVE") state.notes[q.id] = `Внимание: по данным ЕГРЮЛ организация — ${SG.status(st)}. Проверьте выписку на egrul.nalog.ru.`;
            if (final) { prune(spec, state.a); renderForm(false); }
            renderPreview();
          },
        }, h);
      } else if (sgKind && SG.token) {
        sgExtra = h("button", { type: "button", class: "sg-on", onclick: () => { SG.setEnabled(true); renderForm(false); } }, "Включить подсказки");
      }
      const warn = state.notes[q.id] || (sgKind && state.touched[q.id] && !err ? SG.offlineHint(sgKind, v) : null);

      return h("div", { class: "field" + (err ? " has-err" : ""), "data-q": q.id },
        h("label", { class: "field-l", id: id + "-l", for: q.type === "choice" || q.type === "rows" ? null : id }, typeof q.label === "function" ? q.label(state.a, d) : q.label,
          (typeof q.required === "function" ? !q.required(state.a, d) : q.required === false) ? h("span", { class: "opt" }, " — необязательно") : null),
        (() => { const t = typeof q.hint === "function" ? q.hint(state.a, d) : q.hint; return t ? h("p", { class: "field-h" }, t) : null; })(),
        q.suffix ? h("div", { class: "with-suffix" }, control, h("span", { class: "suffix" }, q.suffix)) : control,
        err ? h("p", { class: "field-e", role: "alert" }, err) : null,
        warn ? h("p", { class: "field-w", role: "status" }, warn) : null,
        sgExtra);
    }

    // стоп — не тупик: ссылка на другой документ (link), кнопка, меняющая ответ (action), или мягкое предупреждение (soft)
    function stopBox(stop) {
      const acts = [];
      if (stop.action) acts.push(h("button", { class: "btn", type: "button", onclick: () => {
        Object.entries(stop.action.set || {}).forEach(([k, v]) => { if (v === undefined || v === null) delete state.a[k]; else state.a[k] = v; });
        prune(spec, state.a); renderForm(false); renderPreview();
      } }, stop.action.text));
      if (stop.link) acts.push(h("a", { class: stop.action ? "btn ghost" : "btn", href: stop.link.href }, stop.link.text));
      return h("div", { class: "stop" + (stop.soft ? " soft" : ""), role: "status" }, h("strong", {}, stop.title), h("p", {}, stop.text), acts.length ? h("div", { class: "stop-acts" }, acts) : null);
    }

    // Перерисовка после ухода из поля — отложенная: сначала фокус переходит в поле, куда кликнули,
    // и только потом форма перерисовывается (иначе клик и первые символы в новом поле терялись).
    // Пока кнопка мыши нажата, ждём её отпускания — чтобы не сорвать клик по варианту ответа или кнопке.
    let soonT = null, pointer = false, pending = false;
    function soon() {
      clearTimeout(soonT);
      soonT = setTimeout(() => { if (pointer) { pending = true; return; } renderForm(false); }, 0);
    }
    $form.addEventListener("pointerdown", () => { pointer = true; }, true);
    global.addEventListener && global.addEventListener("pointerup", () => {
      pointer = false;
      if (pending) { pending = false; setTimeout(() => renderForm(false), 0); }
    }, true);

    function renderForm(focusTop) {
      clearTimeout(soonT); pending = false;
      saveDraft();
      const a = state.a, d = spec.derive(a);
      const ae = document.activeElement;
      const active = ae && ae.id;
      let sel = null;
      try { sel = ae && typeof ae.selectionStart === "number" ? [ae.selectionStart, ae.selectionEnd] : null; } catch (e) { sel = null; }
      $form.textContent = "";

      if (state.done) { renderDone(d); return; }

      // шаг можно скрыть целиком: step.show(a, d)
      const steps = spec.steps.filter(s => !s.show || s.show(a, d));
      if (state.step > steps.length - 1) state.step = steps.length - 1;
      const step = steps[state.step];
      const errs = stepErrors(spec, step, a);
      const stop = spec.stop ? spec.stop(a, d) : null;

      const pf = state.prefill && state.step === 0 ? state.prefill : null;
      const pfLabels = pf ? spec.steps.flatMap(s => s.questions).filter(q => pf.ids.includes(q.id)).map(q => { const l = typeof q.label === "function" ? q.label(a, d) : q.label; return String(l || q.id).replace(/[?:]\s*$/, "").toLowerCase(); }) : [];
      const notes = [];
      if (state.shared && state.step === 0) notes.push(h("div", { class: "prefill", role: "status" }, "Открыли черновик по ссылке. Проверьте ответы и дополните своё.",
        h("button", { type: "button", class: "sg-off", onclick: () => { state.shared = false; renderForm(false); } }, "скрыть")));
      if (state.restored && state.step === 0) notes.push(h("div", { class: "prefill", role: "status" }, `Восстановили черновик от ${U.fmtDate(new Date(state.restored))} — он хранится только в этом браузере.`,
        h("button", { type: "button", class: "sg-off", onclick: startOver }, "начать заново")));
      if (state.profileUsed && state.step === 0) notes.push(h("div", { class: "prefill", role: "status" }, "Подставили ваши контакты из «Моих данных» (они хранятся только в этом браузере).",
        h("button", { type: "button", class: "sg-off", onclick: () => { LS.del(PROFILE); state.profileUsed = false; renderForm(false); } }, "забыть")));
      add($form,
        notes,
        pf && pfLabels.length ? h("div", { class: "prefill", role: "status" }, h("strong", {}, `Подставили из ${pf.from}: `), pfLabels.join(", ") + ". Проверьте и заполните остальное.",
          h("button", { type: "button", class: "sg-off", onclick: () => { state.prefill = null; renderForm(false); } }, "скрыть")) : null,
        h("ol", { class: "steps", "aria-label": "Шаги" },
          steps.map((s, i) => h("li", { class: i === state.step ? "cur" : i < state.step ? "past" : "" },
            h("span", { class: "n" }, String(i + 1)), h("span", { class: "t" }, typeof s.title === "function" ? s.title(a, d) : s.title)))),
        h("h2", { class: "step-title" }, typeof step.title === "function" ? step.title(a, d) : step.title),
        step.lead ? h("p", { class: "step-lead" }, step.lead) : null,
        companiesBar(step),
        visibleQuestions(spec, step, a, d).map(q => field(q, d, errs)),
        stop ? stopBox(stop) : null,
        h("div", { class: "nav" },
          state.step > 0 ? h("button", { class: "btn ghost", type: "button", onclick: () => { state.step--; renderForm(true); } }, "Назад") : h("span"),
          h("button", {
            class: "btn", type: "button", disabled: !!stop && !stop.soft,
            onclick: () => {
              const e = stepErrors(spec, step, state.a);
              if (Object.keys(e).length) {
                Object.keys(e).forEach(k => state.touched[k] = true);
                renderForm(false);
                const first = $form.querySelector(".has-err");
                if (first) first.scrollIntoView({ block: "center", behavior: "smooth" });
                return;
              }
              const now = spec.steps.filter(s => !s.show || s.show(state.a, spec.derive(state.a)));
              if (state.step < now.length - 1) state.step++; else state.done = true;
              renderForm(true); renderPreview();
            },
          }, state.step < steps.length - 1 ? "Далее" : "Собрать документ")),
        shareBtn());

      if (active) { const el = document.getElementById(active); if (el) { el.focus(); try { if (sel) el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* дата и число не дают ставить курсор */ } } }
      if (focusTop) $form.scrollIntoView({ block: "start", behavior: "smooth" });
    }

    // «Отправить черновик ссылкой» — для второй стороны договора или родственника
    function shareBtn() {
      const out = h("p", { class: "mydata share" });
      const btn = h("button", { type: "button", class: "sg-off", onclick: async () => {
        const url = global.location.href.split("#")[0] + "#a=" + U.packAnswers(state.a);
        let ok = false;
        try { await navigator.clipboard.writeText(url); ok = true; } catch (e) { ok = false; }
        out.textContent = "";
        out.append(ok ? "Ссылка скопирована. " : "Скопируйте ссылку: ", ok ? "" : h("input", { type: "text", value: url, readonly: true, class: "share-url", onfocus: e => e.target.select() }),
          h("span", { class: "h" }, " В ней все ваши ответы — отправляйте только тому, кому доверяете. Нам ссылка не передаётся."));
      } }, "Отправить черновик ссылкой");
      out.append(btn, h("span", { class: "h" }, " — например, второй стороне договора"));
      return out;
    }

    // «Мои компании» (assets/pro.js): хранятся только в этом браузере
    const PARTIES = global.Pro ? global.Pro.parties(spec) : [];
    function companiesBar(step) {
      const PR = global.Pro;
      const here = PARTIES.filter(pt => pt.step === step);
      const list = PR && here.length ? PR.companies.list() : [];
      if (!list.length) return null;
      return here.map(pt => h("div", { class: "companies" }, h("span", { class: "h" }, `${pt.role}: подставить из сохранённых — `),
        list.map(c => h("button", { type: "button", class: "chip", onclick: () => {
          Object.assign(state.a, PR.companies.toAnswers(c, pt.p, pt.mode));
          prune(spec, state.a); renderForm(false); renderPreview();
        } }, PR.companies.label(c)))));
    }
    function companiesSave(a) {
      const PR = global.Pro;
      if (!PR || !PARTIES.length) return null;
      const list = PR.companies.list();
      const fresh = PARTIES.map(pt => ({ pt, c: PR.companies.fromAnswers(a, pt.p, pt.mode) }))
        .filter(x => x.c.name && !list.some(c => c.name === x.c.name && (c.inn || "") === (x.c.inn || "")));
      if (!fresh.length) return null;
      if (!PR.companies.canAdd()) return h("p", { class: "mydata" }, h("span", { class: "h" }, `Бесплатно можно сохранить ${PR.FREE_LIMIT === 1 ? "одну компанию" : PR.FREE_LIMIT + " компании"}. Сколько угодно компаний и контрагентов — в `), h("a", { href: "../pro.html" }, "тарифе «Бизнес»"), h("span", { class: "h" }, "."));
      return h("p", { class: "mydata" }, fresh.map(x => h("button", { type: "button", class: "btn ghost sm", onclick: () => { PR.companies.save(Object.assign({ role: x.pt.mode === "freelancer" ? "mine" : "other" }, x.c)); renderForm(false); } }, `Запомнить «${PR.companies.label(x.c)}»`)),
        h("span", { class: "h" }, " Только в этом браузере — подставится в другие договоры, акты и счета."));
    }

    function renderDone(d) {
      const a = state.a;
      const ps = spec.render(a, d);
      const guide = spec.guidance ? spec.guidance(a, d) : [];
      const copyBtn = h("button", {
        class: "btn ghost", type: "button",
        onclick: async () => {
          try { await navigator.clipboard.writeText(paragraphsToText(ps)); copyBtn.textContent = "Скопировано"; }
          catch (_) { copyBtn.textContent = "Не вышло — выделите текст справа"; }
        },
      }, "Скопировать текст");
      add($form,
        h("h2", { class: "step-title" }, "Документ готов"),
        h("p", { class: "step-lead" }, "Проверьте текст справа. Если что-то не так, вернитесь и поправьте ответы: документ пересоберётся."),
        h("div", { class: "done-actions" },
          h("button", {
            class: "btn", type: "button",
            onclick: () => {
              const PR = global.Pro, mk = PR ? PR.mark(spec.id) : null;
              const bytes = Docx.buildDocx(mk ? ps.concat([mk]) : ps, PR ? PR.docxOptions(spec.id) : {});
              const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
              const url = URL.createObjectURL(blob);
              const link = h("a", { href: url, download: (spec.fileName ? spec.fileName(a, d) : spec.id) + ".docx" });
              document.body.append(link); link.click(); link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 4000);
            },
          }, "Скачать .docx"),
          copyBtn,
          h("button", { class: "btn ghost", type: "button", onclick: () => global.print() }, "Печать или PDF"),
          h("button", { class: "btn ghost", type: "button", title: "Для заказного письма с описью: распечатайте два экземпляра, ценность впишите от руки", onclick: () => {
            const bytes = Docx.buildDocx(U.opis(ps, spec.fileName ? spec.fileName(a, d) : spec.title));
            const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
            const url = URL.createObjectURL(blob);
            const link = h("a", { href: url, download: "Опись вложения — " + (spec.fileName ? spec.fileName(a, d) : spec.id) + ".docx" });
            document.body.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
          } }, "Опись вложения (ф. 107)"),
          h("button", { class: "btn ghost", type: "button", onclick: () => { state.done = false; state.step = spec.steps.filter(s => !s.show || s.show(state.a, spec.derive(state.a))).length - 1; renderForm(true); } }, "Изменить ответы")),
        global.Pro && global.Pro.mark(spec.id) ? h("p", { class: "mydata" }, h("span", { class: "h" }, `В конце файла будет строка «Составлено на ${global.Pro.CONFIG.SITE}». Без неё и с вашим логотипом — в `), h("a", { href: "../pro.html" }, "тарифе «Бизнес»"), h("span", { class: "h" }, ".")) : null,
        companiesSave(a),
        global.Pro ? global.Pro.thanksBlock(h, spec.id) : null,
        (() => {
          const mine = PROFILE_KEYS.filter(k => allIds.has(k) && a[k]);
          if (!mine.length) return null;
          const saved = LS.get(PROFILE) || {};
          if (mine.every(k => saved[k] === a[k])) return h("p", { class: "mydata" }, "Контакты сохранены в «Моих данных» этого браузера — подставятся в другие документы. ", h("button", { type: "button", class: "sg-off", onclick: () => { LS.del(PROFILE); renderForm(false); } }, "забыть"));
          const btn = h("button", { type: "button", class: "btn ghost sm", onclick: () => { const p = Object.assign({}, saved); mine.forEach(k => { p[k] = a[k]; }); LS.set(PROFILE, p); renderForm(false); } }, "Запомнить мои контакты для других документов");
          return h("p", { class: "mydata" }, btn, h("span", { class: "h" }, " Только в этом браузере. На чужом компьютере не нажимайте."));
        })(),
        shareBtn(),
        h("p", { class: "mydata" }, h("button", { type: "button", class: "sg-off", onclick: startOver }, "Стереть ответы и начать заново")),
        spec.reminders ? U.remindersBlock(h, spec.reminders(a, d), "Сроки — " + (spec.fileName ? spec.fileName(a, d) : spec.title)) : null,
        // следующий шаг цепочки: spec.next(a, d) → [{ id, text, when?, fill }] — ответы переносятся в следующий документ (только эта вкладка)
        (() => {
          const nx = spec.next ? (spec.next(a, d) || []).filter(Boolean) : [];
          if (!nx.length) return null;
          const go = x => () => {
            if (!x.fill) return;
            const fill = {};
            Object.entries(x.fill).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)) fill[k] = v; });
            try { global.sessionStorage.setItem("yp-prefill", JSON.stringify({ to: x.id, from: spec.code, at: Date.now(), a: fill })); } catch (e) { /* без хранилища — просто откроется документ */ }
          };
          return h("div", { class: "next-steps" }, h("h3", {}, "Следующий шаг"),
            h("ul", {}, nx.map(x => h("li", {}, x.when ? h("span", { class: "h" }, x.when + ": ") : null,
              h("a", { href: x.id + ".html", onclick: go(x) }, x.text + (x.fill ? " — с вашими ответами" : ""))))));
        })(),
        (() => { const st = spec.stop ? spec.stop(a, d) : null; return st && st.soft ? stopBox(st) : null; })(),
        guide.length ? h("div", { class: "guide" },
          h("h3", {}, "Что делать дальше"),
          h("ol", {}, guide.map(g => h("li", {}, h("strong", {}, g.title), " ", g.text)))) : null,
        h("p", { class: "disclaimer" }, spec.disclaimer || "Документ составлен по вашим ответам и не является юридической консультацией. Если ситуация спорная или сумма большая, покажите его юристу."));
    }

    function renderPreview() {
      saveDraft();
      const d = spec.derive(state.a);
      const ps = spec.render(state.a, d);
      $preview.textContent = "";
      const paper = h("div", { class: "paper" });
      const withGaps = (el, text) => String(text).split(/(⟨[^⟩]*⟩)/).forEach(part => {
        if (!part) return;
        if (part.startsWith("⟨")) el.append(h("span", { class: "gap" }, part.slice(1, -1)));
        else part.split("\n").forEach((line, i) => { if (i) el.append(h("br")); el.append(line); });
      });
      for (const p of ps) {
        if (p.pageBreak) { paper.append(h("hr", { class: "pbreak" })); continue; }
        if (p.table) {
          const head = p.table.head || 0;
          paper.append(h("div", { class: "pt-wrap" }, h("table", { class: "pt" }, p.table.rows.map((row, ri) => h("tr", {}, row.map(c => {
            const cell = c && typeof c === "object" ? c : { text: c };
            const el = h(ri < head ? "th" : "td", { colspan: cell.span > 1 ? String(cell.span) : null, class: cell.bold ? "b" : null });
            withGaps(el, cell.text == null ? "" : cell.text);
            return el;
          }))))));
          continue;
        }
        const el = h("p", { class: `pp a-${p.align || "both"}${p.bold ? " b" : ""}${p.indent ? " ind" : ""}${p.leftIndent ? " shifted" : ""}` });
        // заглушки ⟨…⟩ подсвечиваем
        withGaps(el, p.text);
        paper.append(el);
      }
      $preview.append(h("div", { class: "preview-h" }, "Предпросмотр"), paper);
    }

    renderForm(false);
    renderPreview();
    if (global.Pro && global.Pro.ready && global.Pro.ready.then) global.Pro.ready.then(() => { if (global.Pro.active) renderForm(false); });
    state.rerender = () => { renderForm(false); renderPreview(); }; // для проверок и внешних кнопок
    return state;
  }

  global.Engine = { U, mount, validateQuestion, stepErrors, prune, paragraphsToText };
})(typeof window !== "undefined" ? window : globalThis);
