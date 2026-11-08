/*
 * К-14. Какой налоговый режим выбрать ИП в 2026 году: НПД, УСН 6%, УСН 15%, АУСН, патент.
 * Основа (2026): закон № 422-ФЗ (НПД: 4% / 6%, лимит 2,4 млн ₽, без работников, без перепродажи и посредничества;
 * взносы за себя не платятся); НК РФ — ст. 346.13 (лимит УСН 490,5 млн ₽), 346.18 п. 6 (минимальный налог 1%), 346.20
 * (ставки, регион может снизить), 346.21 п. 3.1 (УСН 6% уменьшается на взносы: без работников — до 100%, с работниками —
 * до 50%), 346.43 п. 5, 346.45 п. 6 (ПСН: до 15 работников, доход до 20 млн ₽ в 2026 г.), 346.51 п. 1.2 (уменьшение
 * патента на взносы), 145, 164 п. 8 (НДС на УСН: освобождение при доходе до 20 млн ₽; 5% — до 272,5 млн, 7% — до 490,5 млн;
 * ред. 425-ФЗ), 430 п. 1.2, 9 (взносы ИП: 57 390 ₽ + 1% с дохода свыше 300 000 ₽, не больше 321 818 ₽; при УСН 15% база —
 * доходы минус расходы без учёта своих взносов), 425 (взносы за работников 30% до 2 979 000 ₽ на человека, 15,1% сверх;
 * пониженный тариф МСП с 2026 г. — только в приоритетных отраслях); закон № 17-ФЗ (АУСН: 8% / 20%, минимум 3%, доход до
 * 60 млн ₽, до 5 работников, взносы не платятся, кроме взноса на травматизм — 2 959 ₽ в год; не во всех регионах).
 * Расчёт ориентировочный: региональные ставки, льготы и точные правила для работников проверяйте отдельно.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const rub = x => U.money(Math.round(x)) + " ₽";
  const n = x => (typeof x === "number" && x > 0 ? x : 0);
  const Y = { fixed: 57390, onePctCap: 321818, base300: 300000, empRate: 0.30, empBase: 2979000, empRate2: 0.151, npdLimit: 2400000, usnLimit: 490500000, vatFree: 20000000, vat5: 272500000, ausnLimit: 60000000, psnLimit: 20000000, ausnTravm: 2959 };

  const ownContrib = base => Y.fixed + Math.min(Y.onePctCap, Math.max(0, base - Y.base300) * 0.01);

  const spec = {
    id: "k14",
    code: "К-14",
    title: "Какой налоговый режим выбрать ИП",
    lead: "Сравним налог и взносы на самозанятости, упрощёнке 6% и 15%, автоматизированной упрощёнке и патенте по вашим доходам, расходам и работникам — с учётом правил 2026 года и НДС на УСН.",
    status: "draft",
    actual: "08.11.2026",
    defaults: { employees: 0, clients: "people", npd_ok: "yes", ausn: "unknown", usn6: 6, usn15: 15 },

    fields: [
      { id: "rev", type: "money", label: "Доход за год", suffix: "₽", hint: "Всё, что получите от клиентов" },
      { id: "exp", type: "money", label: "Расходы за год, без зарплаты и налогов", suffix: "₽", required: false, hint: "Товар, аренда, реклама, сервисы — с документами" },
      { id: "employees", type: "number", label: "Сколько работников", min: 0 },
      { id: "payroll", type: "money", label: "Зарплата всех работников за год", suffix: "₽", required: false, show: a => n(a.employees) > 0 },
      { id: "clients", type: "choice", label: "Кто клиенты", options: [
        { value: "people", label: "В основном люди" }, { value: "business", label: "В основном компании и ИП" },
      ] },
      { id: "npd_ok", type: "choice", label: "Чем занимаетесь", options: [
        { value: "yes", label: "Своими силами: услуги, работы, свои изделия, аренда жилья" },
        { value: "no", label: "Перепродажа, посредничество, маркируемые товары", hint: "На самозанятости так нельзя" },
      ] },
      { id: "usn6", type: "number", label: "Ставка УСН «доходы» в вашем регионе, %", min: 1, step: "0.1", hint: "Обычно 6%, регион может снизить до 1%" },
      { id: "usn15", type: "number", label: "Ставка УСН «доходы минус расходы», %", min: 5, step: "0.1", hint: "Обычно 15%, регион может снизить до 5%" },
      { id: "ausn", type: "choice", label: "АУСН работает в вашем регионе?", hint: "Список — на ausn.nalog.gov.ru", options: [
        { value: "yes", label: "Да" }, { value: "no", label: "Нет" }, { value: "unknown", label: "Не знаю", hint: "Посчитаем, но с оговоркой" },
      ] },
      { id: "patent", type: "money", label: "Стоимость патента на год", suffix: "₽", required: false, hint: "Если ваш вид деятельности есть в патенте — посчитайте на patent.nalog.gov.ru и впишите сюда" },
    ],

    compute(a) {
      const rev = n(a.rev);
      if (!rev) return null;
      const exp = n(a.exp), emp = Math.floor(n(a.employees)), payroll = emp ? n(a.payroll) : 0;
      // взносы за работников: 30% до предельной базы на человека, 15,1% сверх (общий тариф)
      const perHead = emp ? payroll / emp : 0;
      const empContrib = emp ? emp * (Math.min(perHead, Y.empBase) * Y.empRate + Math.max(0, perHead - Y.empBase) * Y.empRate2) : 0;
      const vatUsn = rev <= Y.vatFree ? 0 : rev <= Y.vat5 ? rev * 5 / 105 : rev * 7 / 107;
      const vatRate = rev <= Y.vatFree ? 0 : rev <= Y.vat5 ? 5 : 7;
      const R = [];

      // НПД
      const npdWhy = emp ? "есть работники" : rev > Y.npdLimit ? "доход больше 2,4 млн ₽" : a.npd_ok === "no" ? "перепродажа и посредничество запрещены" : null;
      R.push({ key: "npd", name: `Самозанятость (${a.clients === "business" ? 6 : 4}%)`, why: npdWhy, tax: rev * (a.clients === "business" ? 0.06 : 0.04), own: 0, empC: 0, vat: 0 });

      // УСН 6%
      const r6 = (n(a.usn6) || 6) / 100, own6 = ownContrib(rev);
      const tax6raw = rev * r6, cut6 = emp ? Math.min(tax6raw * 0.5, own6 + empContrib) : Math.min(tax6raw, own6);
      R.push({ key: "usn6", name: `УСН «доходы» ${String(r6 * 100).replace(".", ",")}%`, why: rev > Y.usnLimit ? "доход больше 490,5 млн ₽" : null, tax: tax6raw - cut6, own: own6, empC: empContrib, vat: vatUsn, note: cut6 ? `налог уменьшен на взносы: −${rub(cut6)}` : "" });

      // УСН 15%
      const r15 = (n(a.usn15) || 15) / 100, own15 = ownContrib(rev - exp);
      const base15 = Math.max(0, rev - exp - payroll - empContrib - own15);
      const tax15 = Math.max(base15 * r15, rev * 0.01);
      R.push({ key: "usn15", name: `УСН «доходы минус расходы» ${String(r15 * 100).replace(".", ",")}%`, why: rev > Y.usnLimit ? "доход больше 490,5 млн ₽" : null, tax: tax15, own: own15, empC: empContrib, vat: vatUsn, note: tax15 === rev * 0.01 && base15 * r15 < rev * 0.01 ? "минимальный налог 1% от дохода" : "" });

      // АУСН
      const ausnWhy = a.ausn === "no" ? "не работает в вашем регионе" : rev > Y.ausnLimit ? "доход больше 60 млн ₽" : emp > 5 ? "больше 5 работников" : null;
      const ausn8 = rev * 0.08, ausn20 = Math.max((rev - exp - payroll) * 0.2, rev * 0.03);
      const ausnBest = Math.min(ausn8, ausn20);
      R.push({ key: "ausn", name: `АУСН ${ausnBest === ausn8 ? "8% с доходов" : "20% доходы минус расходы"}`, why: ausnWhy, tax: ausnBest, own: 0, empC: emp ? Y.ausnTravm : 0, vat: 0, note: (a.ausn === "unknown" ? "проверьте регион; " : "") + "только безналичные расчёты через уполномоченный банк" });

      // ПСН
      const pat = n(a.patent);
      if (pat) {
        const ownP = ownContrib(pat / 0.06);
        const cutP = emp ? Math.min(pat * 0.5, ownP + empContrib) : Math.min(pat, ownP);
        R.push({ key: "psn", name: "Патент", why: rev > Y.psnLimit ? "доход больше 20 млн ₽" : emp > 15 ? "больше 15 работников" : null, tax: pat - cutP, own: ownP, empC: empContrib, vat: 0, note: cutP ? `патент уменьшен на взносы: −${rub(cutP)}` : "" });
      }

      R.forEach(r => r.total = r.tax + r.own + r.empC + r.vat);
      const ok = R.filter(r => !r.why).sort((x, y) => x.total - y.total);
      const best = ok[0];
      const summary = ok.map(r => ({ label: r.name, value: rub(r.total), big: r === best }));
      if (best && ok[1]) summary.push({ label: "Экономия против следующего варианта", value: rub(ok[1].total - best.total) });
      // лишние столбцы (работников нет, НДС нет) не показываем — на телефоне таблица и так узкая
      const cols = [["Налог", r => rub(r.tax)], ["Взносы ИП", r => rub(r.own)], ...(emp ? [["За работников", r => rub(r.empC)]] : []), ...(vatUsn ? [["НДС", r => r.vat ? rub(r.vat) : "—"]] : []), ["Итого", r => rub(r.total)]];
      const table = { head: ["Режим", ...cols.map(c => c[0])], rows: R.map(r => r.why
        ? [r.name, ...cols.slice(0, -1).map(() => "—"), `недоступен: ${r.why}`]
        : [r.name, ...cols.map(c => c[1](r))]) };

      const notes = [];
      if (best) notes.push(`Выгоднее всего — ${best.name}: ${rub(best.total)} в год налогов и взносов, это ${String(Math.round(best.total / rev * 1000) / 10).replace(".", ",")}% дохода.`);
      if (vatUsn) notes.push(`Доход больше 20 млн ₽ — на УСН появляется НДС ${vatRate}% без вычетов (или 22% с вычетами), посчитан как часть цены. Патент и АУСН от НДС освобождены (ст. 145, 164 НК, ред. 425-ФЗ).`);
      notes.push(`Взносы ИП за себя в 2026 году: ${rub(Y.fixed)} до 28 декабря и 1% с дохода свыше 300 000 ₽ (не больше ${rub(Y.onePctCap)}) до 1 июля 2027 года. На самозанятости и АУСН их нет — но и пенсионный стаж не идёт, если не платить добровольно.`);
      if (emp) notes.push("Взносы за работников посчитаны по общему тарифу 30% (15,1% сверх 2 979 000 ₽ на человека). Пониженный тариф 15% с 2026 года — только для МСП из приоритетных отраслей. На АУСН взносов за работников нет, кроме взноса на травматизм.");
      notes.push("Сроки на УСН: авансы до 28 апреля, июля и октября, налог за год и декларация — до 28 и 25 апреля следующего года. Перейти на УСН можно с 1 января (уведомление до 31 декабря) или в течение 30 дней после регистрации ИП.");
      R.filter(r => r.note && !r.why).forEach(r => notes.push(`${r.name}: ${r.note}.`));
      if (!pat) notes.push("Патент не посчитан — его стоимость зависит от региона и вида деятельности. Посчитайте на patent.nalog.gov.ru и впишите выше.");
      notes.push("Расчёт ориентировочный: не учтены региональные льготы, торговый сбор, совмещение режимов и особенности отдельных видов деятельности.");
      return { summary, table, notes };
    },
  };

  global.CALCS = global.CALCS || {};
  global.CALCS.k14 = spec;
})(typeof window !== "undefined" ? window : globalThis);
