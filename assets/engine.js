/*
 * Движок документов.
 * Каждый документ описан спецификацией в content/<id>.js (см. content/README.md).
 * Движок рисует анкету по шагам, показывает живой предпросмотр
 * и собирает .docx прямо в браузере. На сервер ничего не отправляется.
 */
(function (global) {
  "use strict";

  // ---------- Утилиты для спецификаций ----------
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  const U = {
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
    const v = a[q.id];
    const required = q.required !== false;
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);
    if (empty) return required ? "Заполните это поле" : null;
    if (q.type === "date" && !U.date(v)) return "Укажите дату";
    if ((q.type === "money" || q.type === "number") && (isNaN(v) || Number(v) < (q.min ?? 0))) return "Укажите число";
    if (q.options) {
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
    return ps.map(p => p.text).join("\n\n");
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
    const state = { a: {}, step: 0, touched: {}, done: false };

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
      } else if (q.type === "select") {
        control = h("select", {
          id, onchange: e => { state.touched[q.id] = true; set(q.id, e.target.value); },
        }, h("option", { value: "" }, "Выберите…"),
          q.options.map(opt => h("option", { value: opt.value, selected: v === opt.value, disabled: !!optionState(q, opt, state.a, d) }, opt.label)));
      } else if (q.type === "textarea") {
        control = h("textarea", {
          id, rows: 4, placeholder: q.placeholder || "",
          oninput: e => { state.a[q.id] = e.target.value; if (!e.target.value) delete state.a[q.id]; renderPreview(); },
          onblur: () => { state.touched[q.id] = true; prune(spec, state.a); renderForm(false); renderPreview(); },
        });
        control.value = v || "";
      } else {
        const type = q.type === "date" ? "date" : (q.type === "money" || q.type === "number") ? "number" : q.type === "email" ? "email" : q.type === "tel" ? "tel" : "text";
        control = h("input", {
          id, type, placeholder: q.placeholder || "", inputmode: q.type === "money" ? "decimal" : null,
          min: q.type === "money" || q.type === "number" ? (q.min ?? 0) : null, step: q.type === "money" ? "0.01" : null,
          max: q.type === "date" ? U.iso(U.today()) : null,
          autocomplete: q.autocomplete || null,
          oninput: e => {
            const raw = e.target.value;
            state.a[q.id] = (q.type === "money" || q.type === "number") && raw !== "" ? Number(raw) : raw;
            if (raw === "") delete state.a[q.id];
            renderPreview();
          },
          onchange: () => { state.touched[q.id] = true; prune(spec, state.a); renderForm(false); renderPreview(); },
        });
        control.value = v ?? "";
      }

      return h("div", { class: "field" + (err ? " has-err" : ""), "data-q": q.id },
        h("label", { class: "field-l", id: id + "-l", for: q.type === "choice" ? null : id }, q.label,
          q.required === false ? h("span", { class: "opt" }, " — необязательно") : null),
        q.hint ? h("p", { class: "field-h" }, q.hint) : null,
        control,
        q.suffix ? h("span", { class: "suffix" }, q.suffix) : null,
        err ? h("p", { class: "field-e", role: "alert" }, err) : null);
    }

    function renderForm(focusTop) {
      const a = state.a, d = spec.derive(a);
      const active = document.activeElement && document.activeElement.id;
      $form.textContent = "";

      if (state.done) { renderDone(d); return; }

      const step = spec.steps[state.step];
      const errs = stepErrors(spec, step, a);
      const stop = spec.stop ? spec.stop(a, d) : null;

      add($form,
        h("ol", { class: "steps", "aria-label": "Шаги" },
          spec.steps.map((s, i) => h("li", { class: i === state.step ? "cur" : i < state.step ? "past" : "" },
            h("span", { class: "n" }, String(i + 1)), h("span", { class: "t" }, s.title)))),
        h("h2", { class: "step-title" }, step.title),
        step.lead ? h("p", { class: "step-lead" }, step.lead) : null,
        visibleQuestions(spec, step, a, d).map(q => field(q, d, errs)),
        stop ? h("div", { class: "stop", role: "status" }, h("strong", {}, stop.title), h("p", {}, stop.text)) : null,
        h("div", { class: "nav" },
          state.step > 0 ? h("button", { class: "btn ghost", type: "button", onclick: () => { state.step--; renderForm(true); } }, "Назад") : h("span"),
          h("button", {
            class: "btn", type: "button", disabled: !!stop,
            onclick: () => {
              const e = stepErrors(spec, step, state.a);
              if (Object.keys(e).length) {
                Object.keys(e).forEach(k => state.touched[k] = true);
                renderForm(false);
                const first = $form.querySelector(".has-err");
                if (first) first.scrollIntoView({ block: "center", behavior: "smooth" });
                return;
              }
              if (state.step < spec.steps.length - 1) state.step++; else state.done = true;
              renderForm(true); renderPreview();
            },
          }, state.step < spec.steps.length - 1 ? "Далее" : "Собрать документ")));

      if (active) { const el = document.getElementById(active); if (el) el.focus(); }
      if (focusTop) $form.scrollIntoView({ block: "start", behavior: "smooth" });
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
              const bytes = Docx.buildDocx(ps);
              const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
              const url = URL.createObjectURL(blob);
              const link = h("a", { href: url, download: (spec.fileName ? spec.fileName(a, d) : spec.id) + ".docx" });
              document.body.append(link); link.click(); link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 4000);
            },
          }, "Скачать .docx"),
          copyBtn,
          h("button", { class: "btn ghost", type: "button", onclick: () => { state.done = false; state.step = spec.steps.length - 1; renderForm(true); } }, "Изменить ответы")),
        guide.length ? h("div", { class: "guide" },
          h("h3", {}, "Что делать дальше"),
          h("ol", {}, guide.map(g => h("li", {}, h("strong", {}, g.title), " ", g.text)))) : null,
        h("p", { class: "disclaimer" }, spec.disclaimer || "Документ составлен по вашим ответам и не является юридической консультацией. Если ситуация спорная или сумма большая, покажите его юристу."));
    }

    function renderPreview() {
      const d = spec.derive(state.a);
      const ps = spec.render(state.a, d);
      $preview.textContent = "";
      const paper = h("div", { class: "paper" });
      for (const p of ps) {
        const el = h("p", { class: `pp a-${p.align || "both"}${p.bold ? " b" : ""}${p.indent ? " ind" : ""}${p.leftIndent ? " shifted" : ""}` });
        // заглушки ⟨…⟩ подсвечиваем
        String(p.text).split(/(⟨[^⟩]*⟩)/).forEach(part => {
          if (!part) return;
          if (part.startsWith("⟨")) el.append(h("span", { class: "gap" }, part.slice(1, -1)));
          else part.split("\n").forEach((line, i) => { if (i) el.append(h("br")); el.append(line); });
        });
        paper.append(el);
      }
      $preview.append(h("div", { class: "preview-h" }, "Предпросмотр"), paper);
    }

    renderForm(false);
    renderPreview();
    return state;
  }

  global.Engine = { U, mount, validateQuestion, stepErrors, prune, paragraphsToText };
})(typeof window !== "undefined" ? window : globalThis);
