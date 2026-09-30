/*
 * Калькуляторы: поля слева, результат справа, пересчёт на лету. Спецификация — content/kN.js (window.CALCS[id]):
 * { id, code, title, lead, fields: [...как вопросы анкеты: money, number, date, choice, select, textarea, heading (подзаголовок); show(a)],
 *   compute(a) → { error?, summary: [{ label, value, big? }], table?: { head: [], rows: [[]] }, notes: [], related: [{ id, text }] } }
 * Ничего не отправляется на сервер.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else if (k === "checked" || k === "selected") el[k] = !!v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    kids.flat(3).forEach(c => { if (c != null && c !== false) el.append(c.nodeType ? c : String(c)); });
    return el;
  }

  function mount(root, spec) {
    const a = Object.assign({}, spec.defaults || {});
    const $form = h("div", { class: "wiz" });
    const $res = h("div", { class: "calc-res", "aria-live": "polite" });
    root.append(h("div", { class: "doc-layout" }, $form, $res));

    function field(q) {
      if (q.type === "heading") return h("h3", { class: "calc-h" }, q.label);
      const id = "c-" + q.id, v = a[q.id];
      let control;
      if (q.type === "choice") {
        control = h("div", { class: "choices", role: "radiogroup" }, q.options.map(o => h("label", { class: "choice" + (v === o.value ? " on" : "") },
          h("input", { type: "radio", name: id, checked: v === o.value, onchange: () => { a[q.id] = o.value; renderForm(); renderRes(); } }),
          h("span", { class: "choice-t" }, o.label), o.hint ? h("span", { class: "choice-h" }, o.hint) : null)));
      } else if (q.type === "select") {
        control = h("select", { id, onchange: e => { a[q.id] = e.target.value || undefined; renderForm(true); renderRes(); } }, h("option", { value: "" }, "Выберите…"),
          q.options.map(o => h("option", { value: o.value, selected: v === o.value }, o.label)));
      } else if (q.type === "textarea") {
        control = h("textarea", { id, rows: 4, placeholder: q.placeholder || "", oninput: e => { a[q.id] = e.target.value || undefined; renderRes(); } });
        control.value = v || "";
      } else {
        const num = q.type === "money" || q.type === "number";
        control = h("input", { id, type: q.type === "date" ? "date" : num ? "number" : "text", min: num ? (q.min ?? 0) : null, step: q.type === "money" ? "0.01" : q.step || null, placeholder: q.placeholder || "",
          inputmode: q.type === "money" ? "decimal" : null,
          oninput: e => { const r = e.target.value; a[q.id] = r === "" ? undefined : num ? Number(r) : r; renderRes(); },
          onchange: () => renderForm(true) });
        control.value = v ?? "";
      }
      return h("div", { class: "field" },
        h("label", { class: "field-l", for: q.type === "choice" ? null : id }, typeof q.label === "function" ? q.label(a) : q.label, q.required === false ? h("span", { class: "opt" }, " — необязательно") : null),
        q.hint ? h("p", { class: "field-h" }, typeof q.hint === "function" ? q.hint(a) : q.hint) : null, q.suffix ? h("div", { class: "with-suffix" }, control, h("span", { class: "suffix" }, q.suffix)) : control);
    }

    function renderForm(keepFocus) {
      const active = keepFocus && document.activeElement && document.activeElement.id;
      $form.textContent = "";
      $form.append(h("h2", { class: "step-title" }, "Данные"), ...spec.fields.filter(q => !q.show || q.show(a)).map(field));
      if (active) { const el = document.getElementById(active); if (el) el.focus(); }
    }

    function renderRes() {
      $res.textContent = "";
      let r;
      try { r = spec.compute(a); } catch (e) { r = { error: "Проверьте введённые данные" }; }
      $res.append(h("div", { class: "preview-h" }, "Результат"));
      const card = h("div", { class: "paper calc-card" });
      if (!r || r.error) {
        card.append(h("p", { class: "calc-empty" }, (r && r.error) || "Заполните поля слева — расчёт появится здесь."));
        $res.append(card); return;
      }
      // «₽» не отрывается от числа при переносе
      const nb = x => String(x).replace(/ ₽/g, "\u00a0₽");
      (r.summary || []).forEach(s => card.append(h("div", { class: "calc-row" + (s.big ? " big" : "") }, h("span", {}, s.label), h("strong", {}, nb(s.value)))));
      if (r.table && r.table.rows.length) {
        card.append(h("div", { class: "calc-table-wrap" }, h("table", { class: "calc-table" },
          h("thead", {}, h("tr", {}, r.table.head.map(x => h("th", {}, x)))),
          h("tbody", {}, r.table.rows.map(row => h("tr", {}, row.map(x => h("td", {}, nb(x)))))))));
      }
      if (r.notes && r.notes.length) card.append(h("ul", { class: "calc-notes" }, r.notes.map(n => h("li", {}, n))));
      const text = [spec.title, ...(r.summary || []).map(s => `${s.label}: ${s.value}`), ...(r.table ? [r.table.head.join(" | "), ...r.table.rows.map(x => x.join(" | "))] : [])].join("\n");
      const copy = h("button", { class: "btn ghost", type: "button", onclick: async () => {
        try { await navigator.clipboard.writeText(text); copy.textContent = "Скопировано"; } catch (_) { copy.textContent = "Не вышло — выделите текст"; }
      } }, "Скопировать расчёт");
      card.append(h("div", { class: "done-actions" }, copy, (r.related || []).map(x => h("a", { class: "btn", href: x.id + ".html" }, x.text))));
      $res.append(card);
    }

    renderForm(); renderRes();
  }

  global.Calc = { mount };
})(typeof window !== "undefined" ? window : globalThis);
