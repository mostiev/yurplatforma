/*
 * Общие куски текста документов: шапка, подпись, способы возврата денег, приложения.
 * Используется в content/*.js начиная с Д-09.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const F = U.F;

  const LAW_ZOZPP = "Закона РФ от 07.02.1992 № 2300-1 «О защите прав потребителей», далее — Закон";

  const C = {
    LAW_ZOZPP,
    // шапка: to = {name, inn, address, email}, from = {name, address, phone, email}
    header(to, from, P) {
      P.push({ text: `Кому: ${F(to.name, to.nameLabel || "адресат")}` + (to.inn ? `\nИНН ${to.inn}` : "") + `\nАдрес: ${F(to.address, "адрес")}` + (to.email ? `\nE-mail: ${to.email}` : "") + (to.copy ? `\nКопия: ${to.copy}` : ""), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `От: ${F(from.name, "ваши ФИО")}\nАдрес: ${F(from.address, "ваш адрес")}\nТел.: ${F(from.phone, "телефон")}` + (from.email ? `, e-mail: ${from.email}` : ""), align: "left", leftIndent: 4500, after: 360 });
    },
    title(P, word, subtitle) {
      P.push({ text: word, align: "center", bold: true, after: 0 });
      P.push({ text: subtitle, align: "center", after: 240 });
    },
    refundText(method) {
      return { card: "на банковскую карту, с которой производилась оплата", cash: "наличными денежными средствами", same: "тем же способом, которым производилась оплата", requisites: "по реквизитам: ______________________________" }[method] || F(null, "куда вернуть деньги");
    },
    refundQuestion(show) {
      return { id: "refund_method", type: "choice", label: "Куда вернуть деньги?", show, options: [
        { value: "card", label: "На карту, с которой платил(а)" },
        { value: "cash", label: "Наличными" },
        { value: "requisites", label: "По реквизитам", hint: "Оставим пустую строку, впишете от руки" },
      ] };
    },
    innQuestion(id, label) {
      return { id, type: "text", label: label || "ИНН", required: false, placeholder: "10 или 12 цифр",
        validate: v => /^\d{10}(\d{2})?$/.test(String(v).trim()) ? null : "ИНН — это 10 или 12 цифр" };
    },
    personQuestions() {
      return [
        { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
        { id: "buyer_address", type: "text", label: "Ваш адрес для ответа", autocomplete: "street-address" },
        { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel" },
        { id: "buyer_email", type: "email", label: "Электронная почта", required: false, autocomplete: "email" },
      ];
    },
    from(a) { return { name: a.buyer_name, address: a.buyer_address, phone: a.buyer_phone, email: a.buyer_email }; },
    attachments(P, list) {
      if (list.length) P.push({ text: "Приложения:\n" + list.map((x, i) => `${i + 1}. ${x}`).join("\n"), align: "left", before: 120 });
    },
    sign(P, a) {
      P.push({ text: `«___» ____________ 20__ г.            ____________ / ${F(U.shortName(a.buyer_name), "И. О. Фамилия")}`, align: "left", before: 360 });
    },
    courtThreat(kind) {
      const extra = {
        penalty3: "неустойку в размере 3% цены работы (услуги) за каждый день просрочки (п. 5 ст. 28 Закона), ",
        interest: "проценты за пользование чужими денежными средствами (ст. 395 ГК РФ), ",
        none: "",
      }[kind || "none"];
      return `В случае неудовлетворения требования в установленный срок я буду вынужден(а) обратиться в суд и потребую также взыскать ${extra}компенсацию морального вреда (ст. 15 Закона) и штраф в размере 50% от присуждённой суммы (п. 6 ст. 13 Закона).`;
    },
    // ключевая ставка на дату (Date) по таблице assets/keyrate.js
    keyRate(dt) {
      const t = global.KEYRATE || [];
      let r = null;
      for (const [from, rate] of t) { if (U.date(from) <= dt) r = rate; else break; }
      return r;
    },
    // компенсация по ст. 236 ТК: сумма × 1/150 ключевой ставки за каждый день с (срок + 1) по дату расчёта включительно
    comp236(amount, due, payDay) {
      if (!(amount > 0) || !due || !payDay || payDay <= due) return { total: 0, days: 0, parts: [] };
      const parts = [];
      let d = U.addDays(due, 1), total = 0, days = 0;
      while (d <= payDay) {
        const rate = C.keyRate(d);
        if (rate == null) return { total: null, days: 0, parts: [], error: "нет ставки на " + U.fmtDate(d) };
        const add = amount * rate / 100 / 150;
        const last = parts[parts.length - 1];
        if (last && last.rate === rate) { last.days++; last.to = d; last.sum += add; } else parts.push({ from: d, to: d, days: 1, rate, sum: add });
        total += add; days++;
        d = U.addDays(d, 1);
      }
      parts.forEach(p => p.sum = Math.round(p.sum * 100) / 100);
      return { total: Math.round(total * 100) / 100, days, parts };
    },
    // производственный календарь (assets/calendar.js); вне охваченных лет — только субботы и воскресенья
    isWorkday(dt) {
      const cal = global.WORKCAL;
      const s = U.iso(dt);
      if (cal && cal.on.includes(s)) return true;
      if (cal && cal.off.includes(s)) return false;
      return dt.getDay() !== 0 && dt.getDay() !== 6;
    },
    calCovers(dt) { return !!(global.WORKCAL && dt && global.WORKCAL.years.includes(dt.getFullYear())); },
    // n-й рабочий день после события (срок начинается на следующий день — ст. 107 ГПК, ст. 191 ГК)
    addWorkdays(start, n) {
      let d = start, k = 0;
      while (d && k < n) { d = U.addDays(d, 1); if (C.isWorkday(d)) k++; }
      return d;
    },
    // ст. 193 ГК: срок, который кончается в нерабочий день, переносится на ближайший рабочий
    nextWorkday(dt) { let d = dt; while (d && !C.isWorkday(d)) d = U.addDays(d, 1); return d; },

    // проценты по ст. 395 ГК: долг × ключевая ставка / число дней в году (365 или 366) за каждый день просрочки.
    // Первый день — from, последний — to включительно (день уплаты входит). payments: [{date, amount}] уменьшают долг
    // после дня платежа. Возвращает {total, days, parts:[{from,to,days,rate,base,yearDays,sum}], rest}
    comp395(amount, from, to, payments) {
      if (!(amount > 0) || !from || !to || to < from) return { total: 0, days: 0, parts: [], rest: amount > 0 ? amount : 0 };
      const pays = (payments || []).filter(p => p.date && p.amount > 0).sort((x, y) => x.date - y.date);
      let base = amount;
      pays.filter(p => p.date < from).forEach(p => base -= p.amount);
      const parts = [];
      let d = from, total = 0, days = 0;
      while (d <= to && base > 0) {
        const rate = C.keyRate(d);
        if (rate == null) return { total: null, days: 0, parts: [], rest: base, error: "нет ставки на " + U.fmtDate(d) };
        const y = d.getFullYear(), yearDays = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
        const add = base * rate / 100 / yearDays;
        const last = parts[parts.length - 1];
        if (last && last.rate === rate && last.base === base && last.yearDays === yearDays) { last.days++; last.to = d; last.sum += add; }
        else parts.push({ from: d, to: d, days: 1, rate, base, yearDays, sum: add });
        total += add; days++;
        // платёж в этот день: проценты за день начислены, со следующего дня база меньше
        pays.filter(p => U.iso(p.date) === U.iso(d)).forEach(p => base -= p.amount);
        d = U.addDays(d, 1);
      }
      parts.forEach(p => p.sum = Math.round(p.sum * 100) / 100);
      return { total: Math.round(total * 100) / 100, days, parts, rest: Math.max(0, Math.round(base * 100) / 100) };
    },

    // 150000 → «150 000 (сто пятьдесят тысяч) рублей»; 1500,5 → «1 500 (одна тысяча пятьсот) рублей 50 копеек»
    rubles(n) {
      if (n == null || isNaN(n)) return F(null, "сумма");
      const v = Math.round(Number(n) * 100);
      const r = Math.floor(v / 100), k = v % 100;
      const plural = (x, one, few, many) => { const a = x % 100, b = x % 10; return a >= 11 && a <= 14 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
      let s = `${U.money(r)} (${C.words(r)}) ${plural(r, "рубль", "рубля", "рублей")}`;
      if (k) s += ` ${String(k).padStart(2, "0")} ${plural(k, "копейка", "копейки", "копеек")}`;
      return s;
    },
    words(n) {
      if (n === 0) return "ноль";
      const ones = [["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"], ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"]];
      const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
      const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
      const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
      const groups = [[null, 0], [["тысяча", "тысячи", "тысяч"], 1], [["миллион", "миллиона", "миллионов"], 0], [["миллиард", "миллиарда", "миллиардов"], 0]];
      const out = [];
      let g = 0;
      while (n > 0 && g < groups.length) {
        const x = n % 1000; n = Math.floor(n / 1000);
        if (x) {
          const w = [hundreds[Math.floor(x / 100)]];
          const t = x % 100;
          if (t >= 10 && t < 20) w.push(teens[t - 10]); else { w.push(tens[Math.floor(t / 10)]); w.push(ones[groups[g][1]][t % 10]); }
          if (groups[g][0]) { const a = t, b = x % 10; w.push(a >= 11 && a <= 14 ? groups[g][0][2] : b === 1 ? groups[g][0][0] : b >= 2 && b <= 4 ? groups[g][0][1] : groups[g][0][2]); }
          out.unshift(w.filter(Boolean).join(" "));
        }
        g++;
      }
      return out.join(" ");
    },
    // «ДД.ММ.ГГГГ; сумма» построчно → [{date, amount, raw}]
    parseDatedSums(text) {
      return String(text || "").split("\n").map(s => s.trim()).filter(Boolean).map(line => {
        const p = line.split(/\s*;\s*/);
        const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(p[0] || "");
        const date = m ? U.date(`${m[3]}-${m[2]}-${m[1]}`) : null;
        const amount = Number(String(p[1] || "").replace(/\s/g, "").replace(",", "."));
        return { date, amount: isFinite(amount) && amount > 0 ? amount : null, raw: line };
      });
    },
    // паспорт одной строкой или линии для заполнения от руки
    passport(p) {
      return p && String(p).trim() ? `паспорт ${String(p).trim()}` : "паспорт серия ______ № __________, выдан ____________________________ «___» ________ ____ г.";
    },

    // прожиточный минимум в целом по РФ на 2026 год — Федеральный закон от 28.11.2025 № 426-ФЗ (о бюджете);
    // при смене года обновить (мониторинг напоминает)
    PM: { year: 2026, working: 20644, pension: 16288, child: 18371, law: "Федеральный закон от 28.11.2025 № 426-ФЗ" },

    // исполнительное производство: общие вопросы
    ipQuestions(opts) {
      const o = opts || {};
      return [
        { id: "osp", type: "text", label: "Отделение судебных приставов", hint: "Как в постановлении или на Госуслугах", placeholder: "Хамовнический ОСП ГУФССП России по г. Москве" },
        { id: "osp_address", type: "text", label: "Адрес отделения", required: false },
        { id: "bailiff", type: "text", label: "Судебный пристав-исполнитель", required: o.bailiffRequired !== false, hint: "Фамилия и инициалы — есть в постановлении", placeholder: "Иванова А. А." },
        { id: "ip_no", type: "text", label: "Номер исполнительного производства", placeholder: "123456/26/77001-ИП" },
        { id: "ip_date", type: "date", label: "Дата возбуждения", required: false },
        { id: "creditor", type: "text", label: "Взыскатель", required: o.creditorRequired !== false, placeholder: "ПАО «Банк»" },
      ];
    },
    ipLine(a) {
      return `исполнительное производство № ${F(a.ip_no, "номер ИП")}` + (U.date(a.ip_date) ? ` от ${U.fmtDate(U.date(a.ip_date))}` : "");
    },
    // шапка заявления в ФССП: to — строка адресата
    fsspHeader(P, a, to, role) {
      P.push({ text: to + `\n${F(a.osp, "отделение судебных приставов")}` + (a.osp_address ? `\nАдрес: ${a.osp_address}` : ""), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `${role || "Должник"}: ${F(a.buyer_name, "ваши ФИО")}` + (U.date(a.buyer_birth) ? `, ${U.fmtDate(U.date(a.buyer_birth))} г. р.` : "") + `\nАдрес: ${F(a.buyer_address, "адрес")}\nТел.: ${F(a.buyer_phone, "телефон")}` + (a.buyer_email ? `, e-mail: ${a.buyer_email}` : ""), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `Исполнительное производство № ${F(a.ip_no, "номер ИП")}` + (a.creditor ? `\nВзыскатель: ${a.creditor}` : ""), align: "left", leftIndent: 4500, after: 360 });
    },

    guideSend: { title: "Вручите претензию под подпись или отправьте ценным письмом с описью вложения.", text: "На вашем экземпляре должны быть дата, подпись и должность сотрудника. Сохраните квитанцию и трек-номер." },
    guideCourt: { title: "Не выполнили в срок.", text: "Жалоба в Роспотребнадзор и иск в суд по месту вашего жительства; госпошлину потребитель не платит при цене иска до 1 млн ₽." },
  };

  global.Common = C;
})(typeof window !== "undefined" ? window : globalThis);
