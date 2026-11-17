/*
 * К-18. Пени за просрочку оплаты ЖКУ и проверка расчёта УК.
 * Основа: ЖК РФ — ч. 1 ст. 155 (срок оплаты — до 15-го числа месяца, следующего за расчётным, с 01.03.2026;
 * раньше — до 10-го, если договором управления не был установлен другой срок; Федеральный закон от 24.06.2025 № 177-ФЗ ввёл единый срок), ч. 14 ст. 155 (первые 30 дней — без
 * пеней; с 31-го по 90-й день — 1/300 ставки ЦБ, с 91-го дня — 1/130, ставка на день фактической оплаты),
 * ч. 14.1 (взносы на капремонт — 1/300 с 31-го дня). ГК РФ — ст. 193 (перенос срока с выходного), ст. 333
 * (уменьшение пеней судом). ПП РФ от 18.03.2025 № 329: до 01.01.2027 для отношений, возникших с 01.01.2025, берётся
 * меньшая из ставок — 9,5% или действующая на день оплаты. Пленум ВС РФ от 27.06.2017 № 22 (п. 38, 39 — ставка на
 * день оплаты; уменьшение по ст. 333).
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const rub = x => U.money(Math.round(x * 100) / 100) + " ₽";
  const D = dt => U.fmtDate(dt);
  const CAP_UNTIL = new Date(2027, 0, 1);

  // «03.2026; 4 500» построчно → [{ y, m, amount }]
  function parse(text) {
    return String(text || "").split("\n").map(s => s.trim()).filter(Boolean).map(line => {
      const p = line.split(/\s*;\s*|\s+—\s+|\t/);
      const mm = /^(\d{1,2})[.\/](\d{4})$/.exec(p[0] || "");
      const amount = Number(String(p[1] || "").replace(/\s|₽|руб\.?/g, "").replace(",", "."));
      return mm ? { y: +mm[2], m: +mm[1] - 1, amount: isFinite(amount) && amount > 0 ? amount : null, raw: line } : { raw: line, bad: true };
    });
  }

  function dueDate(y, m, customDay) {
    // плата за месяц m вносится в следующем месяце: до 15-го (с 01.03.2026), раньше — до 10-го
    const next = new Date(y, m + 1, 1);
    // с 01.03.2026 срок единый — 15-е число (177-ФЗ); свой срок из договора управления действовал только раньше
    const day = next >= new Date(2026, 2, 1) ? 15 : (customDay || 10);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    return C.nextWorkday(new Date(next.getFullYear(), next.getMonth(), Math.min(day, last)));
  }

  function penalty(amount, due, payDay, kind) {
    const key = C.keyRate(payDay);
    if (key == null) return { error: true };
    const rate = payDay < CAP_UNTIL ? Math.min(9.5, key) : key;
    const days = U.daysBetween(due, payDay); // день оплаты включаем
    let p300 = 0, p130 = 0;
    if (days > 30) p300 = Math.min(days, kind === "repair" ? days : 90) - 30;
    if (days > 90 && kind !== "repair") p130 = days - 90;
    const sum = amount * rate / 100 * (p300 / 300 + p130 / 130);
    return { days, p300, p130, rate, sum: Math.round(sum * 100) / 100 };
  }

  const spec = {
    id: "k18",
    code: "К-18",
    title: "Пени за коммунальные услуги: калькулятор и проверка УК",
    lead: "Посчитаем пени по ЖКУ по правилам ч. 14 ст. 155 ЖК: первые 30 дней — бесплатно, дальше 1/300 и 1/130 ставки, но до конца 2026 года — не выше 9,5%. Сравните с суммой в квитанции.",
    status: "draft",
    actual: "17.11.2026",
    defaults: { kind: "housing", paid: "no" },

    fields: [
      { id: "kind", type: "choice", label: "За что долг", options: [
        { value: "housing", label: "Квартплата и коммунальные услуги" },
        { value: "repair", label: "Взносы на капремонт", hint: "Пени только 1/300, без повышения после 90 дней (ч. 14.1 ст. 155 ЖК)" },
      ] },
      { id: "debts", type: "textarea", label: "Месяцы и суммы долга", hint: "Каждый месяц с новой строки: месяц.год; сумма. Например: 03.2026; 4 850", placeholder: "03.2026; 4 850\n04.2026; 4 620\n05.2026; 4 300" },
      { id: "paid", type: "choice", label: "Долг уже оплачен?", options: [
        { value: "no", label: "Нет — посчитать на сегодня" }, { value: "yes", label: "Да" },
      ] },
      { id: "pay_date", type: "date", label: "Когда оплатили", show: a => a.paid === "yes" },
      { id: "due_day", type: "number", label: "Срок оплаты по договору управления — для долгов до февраля 2026 года", required: false, min: 1, hint: "Раньше договор мог установить свой срок вместо 10-го числа. С 01.03.2026 срок единый — до 15-го числа следующего месяца, и это поле не применяется" },
      { id: "billed", type: "money", label: "Сколько пеней насчитала УК", suffix: "₽", required: false, hint: "Сравним с нашим расчётом" },
    ],

    compute(a) {
      const rows = parse(a.debts);
      if (!rows.length) return null;
      const bad = rows.filter(r => r.bad || !r.amount);
      if (bad.length) return { error: `Не понятна строка «${bad[0].raw}». Формат: месяц.год; сумма — например, 03.2026; 4 850` };
      const payDay = a.paid === "yes" ? U.date(a.pay_date) : U.today();
      if (!payDay) return null;
      const early = rows.find(r => r.y < 2025);
      const out = [];
      let total = 0, debt = 0;
      for (const r of rows) {
        const due = dueDate(r.y, r.m, Math.floor(Number(a.due_day) || 0) || null);
        const p = penalty(r.amount, due, payDay, a.kind);
        if (p.error) return { error: "Нет ставки ЦБ на эту дату." };
        debt += r.amount; total += p.sum;
        out.push([`${String(r.m + 1).padStart(2, "0")}.${r.y}`, rub(r.amount), `до ${D(due)}`, p.days > 0 ? `${p.days}` : "—",
          p.sum ? `${rub(p.sum)}` + (p.p130 ? ` (${p.p300} дн. × 1/300, ${p.p130} дн. × 1/130)` : ` (${p.p300} дн. × 1/300)`) : "0 ₽"]);
      }
      const key = C.keyRate(payDay);
      const rate = payDay < CAP_UNTIL ? Math.min(9.5, key) : key;
      const summary = [
        { label: "Долг", value: rub(debt) },
        { label: "Пени по закону", value: rub(total), big: true },
      ];
      if (a.billed > 0) {
        const diff = a.billed - total;
        summary.push({ label: diff > 1 ? "УК насчитала больше на" : "Разница с УК", value: rub(Math.abs(diff)) });
      }
      const notes = [];
      notes.push(`Ставка: ${String(rate).replace(".", ",")}% — ` + (payDay < CAP_UNTIL ? `меньшая из 9,5% и ключевой ставки ЦБ на ${D(payDay)} (${String(key).replace(".", ",")}%), ПП РФ № 329 действует до 01.01.2027` : `ключевая ставка ЦБ на день оплаты`) + ". Если долг ещё не погашен, итог меняется каждый день.");
      notes.push(a.kind === "repair" ? "Капремонт: 1/300 ставки за каждый день, начиная с 31-го дня просрочки (ч. 14.1 ст. 155 ЖК)." : "Первые 30 дней после срока пеней нет, с 31-го по 90-й — 1/300 ставки, с 91-го — 1/130 (ч. 14 ст. 155 ЖК).");
      if (a.billed > 0 && a.billed - total > 1) notes.push("УК насчитала больше. Частые ошибки: пени с первого дня, по текущей ключевой ставке вместо 9,5%, пени на пени, на сумму с уже начисленными пенями. Потребуйте письменный расчёт и перерасчёт; если откажут — жалоба в жилищную инспекцию.");
      notes.push("Если пени взыскивают через суд, попросите уменьшить их по ст. 333 ГК: суд может снизить пени, явно несоразмерные долгу (п. 39 Пленума ВС № 22).");
      if (early) notes.push("Для долгов до 2025 года действовали другие правила: мораторий с 06.04.2020 по 01.01.2021 и с 01.04 по 01.10.2022, ставка 9,5% в 2022 году. Расчёт за эти месяцы может быть неточным — проверьте с юристом.");
      notes.push("В новых регионах с 27.07.2026 пени не начисляются (ПП РФ от 24.07.2026 № 931).");

      return {
        summary,
        table: { head: ["Месяц", "Долг", "Срок оплаты", "Дней просрочки", "Пени"], rows: out, text: true },
        notes,
        related: [{ id: "d16", text: "Жалоба на УК в жилищную инспекцию" }, { id: "d15", text: "Перерасчёт за ЖКУ" }, { id: "k17", text: "Не истекла ли исковая давность по старым месяцам" }],
      };
    },
  };

  global.CALCS = global.CALCS || {};
  global.CALCS.k18 = spec;
})(typeof window !== "undefined" ? window : globalThis);
