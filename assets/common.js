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
      P.push({ text: `Кому: ${F(to.name, to.nameLabel || "адресат")}` + (to.inn ? `\nИНН ${to.inn}` : "") + `\nАдрес: ${to.blank && !to.address ? "______________________________" : F(to.address, "адрес")}` + (to.email ? `\nE-mail: ${to.email}` : "") + (to.copy ? `\nКопия: ${to.copy}` : ""), align: "left", leftIndent: 4500, after: 120 });
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
    // opts.zero: [[isoFrom, isoTo], …] — дни, за которые проценты не начисляются (мораторий), в расчёте показываются со ставкой 0
    comp395(amount, from, to, payments, opts) {
      if (!(amount > 0) || !from || !to || to < from) return { total: 0, days: 0, parts: [], rest: amount > 0 ? amount : 0 };
      const zero = (opts && opts.zero) || [];
      const pays = (payments || []).filter(p => p.date && p.amount > 0).sort((x, y) => x.date - y.date);
      let base = amount;
      pays.filter(p => p.date < from).forEach(p => base -= p.amount);
      const parts = [];
      let d = from, total = 0, days = 0;
      while (d <= to && base > 0) {
        const iso = U.iso(d);
        const off = zero.some(([x, y]) => iso >= x && iso <= y);
        const rate = off ? 0 : C.keyRate(d);
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

    // мораторий на банкротство (ПП № 497 от 28.03.2022): 01.04.2022–01.10.2022 проценты и неустойки по денежным
    // обязательствам, возникшим до 01.04.2022, не начисляются (п. 7 ППВС от 24.12.2020 № 44), кроме должников-исключений
    MORATORIUM_2022: ["2022-04-01", "2022-10-01"],

    // неустойка застройщика по ч. 2 ст. 6 214-ФЗ: цена × ставка на последний день срока (ВС 127-КГ23-18-К4) / 300
    // за каждый день; гражданину — вдвое. Моратории: ПП № 423 (03.04.2020–31.12.2020), ПП № 479 (29.03.2022–30.06.2023),
    // ПП № 326 с продлениями (22.03.2024–31.12.2025); с 01.07.2023 по 31.12.2025 — ставка не выше 7,5% (п. 2 ПП № 326).
    // Первый день — следующий за сроком, последний — end включительно (день передачи по акту)
    DDU_ZERO: [["2020-04-03", "2020-12-31"], ["2022-03-29", "2023-06-30"], ["2024-03-22", "2025-12-31"]],
    dduPenalty(price, due, end, citizen) {
      if (!(price > 0) || !due || !end || end <= due) return null;
      const base = C.keyRate(due);
      if (base == null) return { error: true };
      const k = citizen === false ? 1 : 2;
      const parts = [];
      let d = U.addDays(due, 1), total = 0, days = 0, paidDays = 0;
      while (d <= end) {
        const iso = U.iso(d);
        const zero = C.DDU_ZERO.some(([x, y]) => iso >= x && iso <= y);
        const rate = zero ? 0 : (iso >= "2023-07-01" && iso <= "2025-12-31" ? Math.min(base, 7.5) : base);
        const add = price * rate / 100 / 300 * k;
        const last = parts[parts.length - 1];
        if (last && last.rate === rate) { last.to = d; last.days++; last.sum += add; }
        else parts.push({ from: d, to: d, days: 1, rate, sum: add });
        total += add; days++; if (!zero) paidDays++;
        d = U.addDays(d, 1);
      }
      parts.forEach(p => p.sum = Math.round(p.sum * 100) / 100);
      return { base, k, parts, total: Math.round(total * 100) / 100, days, paidDays };
    },

    // ст. 136 ТК: если день выплаты зарплаты выпал на выходной или праздник — платят накануне
    prevWorkday(dt) { let d = dt; while (d && !C.isWorkday(d)) d = U.addDays(d, -1); return d; },

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

    // фиксированный авансовый платёж по НДФЛ за патент (ст. 227.1 НК): 1 200 ₽ × дефлятор × региональный коэффициент в месяц.
    // Дефлятор на 2026 год — приказ Минэкономразвития от 06.11.2025 № 734 (2025 год — 2,594). При смене года обновить
    PATENT: { year: 2026, base: 1200, deflator: 2.842, law: "приказ Минэкономразвития России от 06.11.2025 № 734" },

    // госпошлина по имущественному иску в суд общей юрисдикции — пп. 1 п. 1 ст. 333.19 НК (ред. 259-ФЗ, с 08.09.2024)
    courtFee(price) {
      const S = [[0, 4000, 0], [100000, 4000, 3], [300000, 10000, 2.5], [500000, 15000, 2], [1000000, 25000, 1],
        [3000000, 45000, 0.7], [8000000, 80000, 0.35], [24000000, 136000, 0.3], [50000000, 214000, 0.2], [100000000, 314000, 0.15]];
      let row = S[0];
      for (const r of S) if (price > r[0]) row = r;
      return Math.round(Math.min(900000, row[1] + (price - row[0]) * row[2] / 100));
    },

    // среднемесячная начисленная зарплата в целом по РФ (Росстат) — для долга по алиментам, если должник не работал
    // (п. 4 ст. 113 СК, ч. 3 ст. 102 229-ФЗ). Обновлять по мере публикации Росстатом (примерно через 2 месяца).
    AVGWAGE: { period: "июнь 2026", value: 114743, source: "Росстат (справка КонсультантПлюс «Среднемесячная заработная плата в целом по РФ»), опубл. 03.09.2026" },

    // долг по алиментам и неустойка по месяцам (п. 2 ст. 115 СК; п. 64 Пленума ВС от 26.12.2017 № 56 — по каждому месячному
    // платежу отдельно, дни просрочки — на день расчёта). Платёж за месяц считается просроченным со следующего дня после
    // окончания месяца. Неполные месяцы — пропорционально дням. Оплаты гасят самые старые долги.
    // o = { from: Date, to: Date, perMonth: число, paid: число, calc: Date }
    alimonySchedule(o) {
      const rows = [];
      let d = new Date(o.from.getFullYear(), o.from.getMonth(), 1);
      while (d <= o.to) {
        const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const mEnd = new Date(d.getFullYear(), d.getMonth(), dim);
        const a = o.from > d ? o.from : d, b = o.to < mEnd ? o.to : mEnd;
        const days = U.daysBetween(a, b) + 1;
        const accrued = Math.round(o.perMonth * (days === dim ? 1 : days / dim) * 100) / 100;
        rows.push({ month: new Date(d), mEnd, partDays: days === dim ? null : days, dim, accrued });
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      }
      let left = Math.max(0, o.paid || 0);
      let debt = 0, pen = 0;
      rows.forEach(r => {
        const pay = Math.min(left, r.accrued); left -= pay;
        r.paid = Math.round(pay * 100) / 100;
        r.unpaid = Math.round((r.accrued - pay) * 100) / 100;
        r.late = o.calc > r.mEnd ? U.daysBetween(r.mEnd, o.calc) : 0;
        r.penalty = Math.round(r.unpaid * 0.001 * r.late * 100) / 100;
        debt += r.unpaid; pen += r.penalty;
      });
      const accrued = rows.reduce((s, r) => s + r.accrued, 0);
      return { rows, accrued: Math.round(accrued * 100) / 100, debt: Math.round(debt * 100) / 100, penalty: Math.round(pen * 100) / 100, overpaid: Math.round(left * 100) / 100 };
    },

    // нерабочие праздничные дни по ч. 1 ст. 112 ТК (без выходных и переносов) — для отпусков (ст. 120) и сроков в календарных днях
    HOLIDAYS112: ["01-01", "01-02", "01-03", "01-04", "01-05", "01-06", "01-07", "01-08", "02-23", "03-08", "05-01", "05-09", "06-12", "11-04"],
    isHoliday112(dt) { return !!dt && C.HOLIDAYS112.includes(U.iso(dt).slice(5)); },

    // 1 минуту / 2 минуты / 5 минут
    plural(x, one, few, many) { const a = Math.abs(x) % 100, b = a % 10; return a >= 11 && a <= 14 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; },

    // работник и работодатель: общие вопросы и шапка для заявлений на работе (Д-56, Д-57)
    jobQuestions() {
      return [
        { id: "org_name", type: "text", label: "Работодатель", placeholder: "ООО «Ромашка»" },
        { id: "head_position", type: "text", label: "Должность руководителя", placeholder: "Генеральный директор" },
        { id: "head_name", type: "text", label: "ФИО руководителя", placeholder: "Иванов Иван Иванович" },
        { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
        { id: "position", type: "text", label: "Ваша должность", placeholder: "Менеджер по продажам" },
        { id: "department", type: "text", label: "Отдел", required: false },
      ];
    },
    jobHeader(P, a) {
      P.push({ text: `Кому: ${F(a.head_position, "должность руководителя")} ${F(a.org_name, "работодатель")}\n${F(a.head_name, "ФИО руководителя")}\nОт: ${F(a.buyer_name, "ваши ФИО")}\nДолжность: ${F(a.position, "должность")}${a.department ? ", " + a.department : ""}`, align: "left", leftIndent: 4500, after: 360 });
    },

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

    // самозанятый (исполнитель) и заказчик: общие вопросы для Д-29…Д-32
    freelancerQuestions() {
      return [
        { id: "ex_name", type: "text", label: "Ваши ФИО (исполнитель)" },
        { id: "ex_inn", type: "text", label: "Ваш ИНН", validate: v => /^\d{12}$/.test(String(v).trim()) ? null : "ИНН физлица — 12 цифр" },
        { id: "ex_address", type: "text", label: "Ваш адрес" },
        { id: "ex_phone", type: "tel", label: "Телефон" },
        { id: "ex_email", type: "email", label: "E-mail", required: false },
        { id: "ex_bank", type: "text", label: "Банк", placeholder: "АО «Т-Банк»" },
        { id: "ex_account", type: "text", label: "Номер счёта", hint: "20 цифр", validate: v => /^\d{20}$/.test(String(v).replace(/\s/g, "")) ? null : "Номер счёта — 20 цифр" },
        { id: "ex_bik", type: "text", label: "БИК", validate: v => /^\d{9}$/.test(String(v).trim()) ? null : "БИК — 9 цифр" },
        { id: "ex_corr", type: "text", label: "Корреспондентский счёт", required: false },
      ];
    },
    clientQuestions() {
      return [
        { id: "cl_type", type: "choice", label: "Заказчик — это", options: [
          { value: "org", label: "Организация или ИП" },
          { value: "person", label: "Физическое лицо" },
        ] },
        { id: "cl_name", type: "text", label: "Заказчик", placeholder: "ООО «Ромашка» или Иванов Иван Иванович" },
        { id: "cl_inn", type: "text", label: "ИНН заказчика", show: a => a.cl_type === "org", validate: v => /^\d{10}(\d{2})?$/.test(String(v).trim()) ? null : "ИНН — 10 или 12 цифр" },
        { id: "cl_ogrn", type: "text", label: "ОГРН / ОГРНИП", required: false, show: a => a.cl_type === "org" },
        { id: "cl_address", type: "text", label: "Адрес заказчика" },
        { id: "cl_signer", type: "text", label: "Кто подписывает от заказчика", show: a => a.cl_type === "org", placeholder: "Генеральный директор Иванов Иван Иванович, действующий на основании Устава" },
      ];
    },
    exLine(a) {
      return `${F(a.ex_name, "ФИО исполнителя")}, ИНН ${F(a.ex_inn, "ИНН")}, применяющий(ая) специальный налоговый режим «Налог на профессиональный доход»`;
    },
    clLine(a) {
      return a.cl_type === "org"
        ? `${F(a.cl_name, "заказчик")}, ИНН ${F(a.cl_inn, "ИНН")}` + (a.cl_ogrn ? `, ОГРН ${a.cl_ogrn}` : "") + `, в лице ${F(a.cl_signer, "кто подписывает")}`
        : `${F(a.cl_name, "заказчик")}`;
    },
    exRequisites(a) {
      return `${F(a.ex_name, "ФИО")}\nИНН ${F(a.ex_inn, "ИНН")}\nАдрес: ${F(a.ex_address, "адрес")}\nТел.: ${F(a.ex_phone, "телефон")}` + (a.ex_email ? `, e-mail: ${a.ex_email}` : "") +
        `\nСчёт № ${F(a.ex_account ? String(a.ex_account).replace(/\s/g, "") : null, "счёт")} в ${F(a.ex_bank, "банк")}\nБИК ${F(a.ex_bik, "БИК")}` + (a.ex_corr ? `, к/с ${a.ex_corr}` : "");
    },
    clRequisites(a) {
      return `${F(a.cl_name, "заказчик")}` + (a.cl_type === "org" ? `\nИНН ${F(a.cl_inn, "ИНН")}` + (a.cl_ogrn ? `, ОГРН ${a.cl_ogrn}` : "") : "") + `\nАдрес: ${F(a.cl_address, "адрес")}`;
    },
    // ---------- Стороны-предприниматели (ИП и организации) ----------
    // p — префикс полей, who — «Исполнитель», «Заказчик» и т. п.; opts.bank — спросить банковские реквизиты
    bizParty(p, who, opts) {
      const o = opts || {};
      const kind = a => a[p + "_kind"] || "org";
      const org = a => kind(a) === "org";
      const person = a => kind(a) === "person";
      const lw = who.toLowerCase();
      return [
        { id: p + "_kind", type: "choice", label: `${who} — это`, options: [
          { value: "org", label: "Организация (ООО, АО)" },
          { value: "ip", label: "Индивидуальный предприниматель" },
          ...(o.person ? [{ value: "person", label: "Физическое лицо", hint: o.personHint }] : []),
        ] },
        { id: p + "_name", type: "text", label: a => org(a) ? `Название (${lw})` : person(a) ? `ФИО (${lw})` : `ФИО предпринимателя (${lw})`, placeholder: "ООО «Ромашка» или Иванов Иван Иванович" },
        { id: p + "_inn", type: "text", label: "ИНН", required: a => !person(a), hint: a => person(a) ? null : "Остальные реквизиты можно найти по ИНН в выписке ЕГРЮЛ/ЕГРИП на egrul.nalog.ru", validate: (v, a) => (org(a) ? /^\d{10}$/ : /^\d{12}$/).test(String(v).trim()) ? null : org(a) ? "ИНН организации — 10 цифр" : "ИНН физлица и ИП — 12 цифр" },
        { id: p + "_passport", type: "text", label: "Паспорт: серия, номер, кем и когда выдан", show: person, placeholder: "45 12 345678, выдан ГУ МВД России по г. Москве 01.02.2020" },
        { id: p + "_ogrn", type: "text", label: a => org(a) ? "ОГРН" : "ОГРНИП", required: false, show: a => !person(a), validate: (v, a) => (org(a) ? /^\d{13}$/ : /^\d{15}$/).test(String(v).trim()) ? null : org(a) ? "ОГРН — 13 цифр" : "ОГРНИП — 15 цифр" },
        { id: p + "_kpp", type: "text", label: "КПП", required: false, show: org, validate: v => /^\d{9}$/.test(String(v).trim()) ? null : "КПП — 9 цифр" },
        { id: p + "_address", type: "text", label: a => org(a) ? "Юридический адрес" : person(a) ? "Адрес регистрации" : "Адрес" },
        { id: p + "_head_pos", type: "text", label: "Должность подписанта", show: org, placeholder: "Генеральный директор" },
        { id: p + "_head", type: "text", label: "ФИО подписанта", show: org, placeholder: "Иванов Иван Иванович" },
        { id: p + "_basis", type: "text", label: "Подписант действует на основании", required: false, show: org, placeholder: "Устава" },
        { id: p + "_email", type: "email", label: "E-mail для документов и уведомлений", required: o.emailRequired === true },
        ...(o.bank ? [
          { id: p + "_bank", type: "text", label: "Банк", required: false, placeholder: "ПАО Сбербанк" },
          { id: p + "_account", type: "text", label: "Расчётный счёт", required: false, validate: v => /^\d{20}$/.test(String(v).replace(/\s/g, "")) ? null : "Номер счёта — 20 цифр" },
          { id: p + "_bik", type: "text", label: "БИК", required: false, validate: v => /^\d{9}$/.test(String(v).trim()) ? null : "БИК — 9 цифр" },
        ] : []),
      ];
    },
    // строка преамбулы: «ООО «Ромашка» (ИНН …), именуемое в дальнейшем «Заказчик», от имени которого действует …»
    bizLine(a, p, role) {
      const ip = a[p + "_kind"] === "ip";
      if (a[p + "_kind"] === "person") return `${F(a[p + "_name"], "ФИО")}, паспорт ${F(a[p + "_passport"], "паспорт")}` + (a[p + "_inn"] ? `, ИНН ${a[p + "_inn"]}` : "") + `, зарегистрированный(ая) по адресу: ${F(a[p + "_address"], "адрес")}, именуемый(ая) в дальнейшем «${role}»`;
      const ids = `ИНН ${F(a[p + "_inn"], "ИНН")}` + (a[p + "_ogrn"] ? `, ${ip ? "ОГРНИП" : "ОГРН"} ${a[p + "_ogrn"]}` : "");
      if (ip) return `индивидуальный предприниматель ${F(a[p + "_name"], "ФИО")} (${ids}), именуемый(ая) в дальнейшем «${role}»`;
      const pos = a[p + "_head_pos"] ? a[p + "_head_pos"][0].toLowerCase() + a[p + "_head_pos"].slice(1) : null;
      return `${F(a[p + "_name"], "организация")} (${ids}), именуемое в дальнейшем «${role}», от имени которого действует ${F(pos, "должность")} ${F(a[p + "_head"], "ФИО подписанта")} на основании ${a[p + "_basis"] || "Устава"}`;
    },
    bizName(a, p) { return a[p + "_kind"] === "ip" ? `ИП ${F(a[p + "_name"], "ФИО")}` : F(a[p + "_name"], a[p + "_kind"] === "person" ? "ФИО" : "организация"); },
    bizRequisites(a, p) {
      const ip = a[p + "_kind"] === "ip";
      if (a[p + "_kind"] === "person") return [F(a[p + "_name"], "ФИО"), `Паспорт: ${F(a[p + "_passport"], "паспорт")}`, a[p + "_inn"] ? `ИНН ${a[p + "_inn"]}` : null, `Адрес: ${F(a[p + "_address"], "адрес")}`, a[p + "_email"] ? `E-mail: ${a[p + "_email"]}` : null, a[p + "_account"] ? `Счёт ${String(a[p + "_account"]).replace(/\s/g, "")}` + (a[p + "_bank"] ? ` в ${a[p + "_bank"]}` : "") : null, a[p + "_bik"] ? `БИК ${a[p + "_bik"]}` : null].filter(Boolean).join("\n");
      return [
        ip ? `ИП ${F(a[p + "_name"], "ФИО")}` : F(a[p + "_name"], "организация"),
        `ИНН ${F(a[p + "_inn"], "ИНН")}` + (a[p + "_kpp"] && !ip ? `, КПП ${a[p + "_kpp"]}` : ""),
        a[p + "_ogrn"] ? `${ip ? "ОГРНИП" : "ОГРН"} ${a[p + "_ogrn"]}` : null,
        `Адрес: ${F(a[p + "_address"], "адрес")}`,
        a[p + "_email"] ? `E-mail: ${a[p + "_email"]}` : null,
        a[p + "_account"] ? `Р/с ${String(a[p + "_account"]).replace(/\s/g, "")}` + (a[p + "_bank"] ? ` в ${a[p + "_bank"]}` : "") : null,
        a[p + "_bik"] ? `БИК ${a[p + "_bik"]}` : null,
      ].filter(Boolean).join("\n");
    },
    bizSignature(a, p) {
      const ip = a[p + "_kind"] === "ip";
      if (a[p + "_kind"] === "person") return `\n____________ / ${F(U.shortName(a[p + "_name"]), "И. О. Фамилия")}`;
      return ip
        ? `Индивидуальный предприниматель\n\n____________ / ${F(U.shortName(a[p + "_name"]), "И. О. Фамилия")}`
        : `${F(a[p + "_head_pos"], "должность")}\n\n____________ / ${F(U.shortName(a[p + "_head"]), "И. О. Фамилия")}\nМ. П. (при наличии)`;
    },
    // таблица «Реквизиты и подписи сторон»: sides — [[префикс, роль], [префикс, роль]]
    bizSignTable(P, a, sides) {
      P.push({ text: "Реквизиты и подписи сторон", align: "center", bold: true, before: 240, after: 120, keepNext: true });
      P.push({ table: { widths: [4677, 4678], head: 1, rows: [sides.map(s => s[1]), sides.map(s => C.bizRequisites(a, s[0]) + "\n\n" + C.bizSignature(a, s[0]))] } });
    },
    // НДС в цене: none — освобождение (ст. 145 НК, в 2026 году — УСН с доходом до 20 млн ₽), 5 / 7 — УСН, 22 — общая ставка
    vatQuestion(id, who) {
      return { id: id || "vat", type: "choice", label: who ? `НДС: ${who}` : "НДС в цене", hint: "С 2026 года упрощенцы с доходом больше 20 млн ₽ в год платят НДС 5% или 7% (или 22% с вычетами)", options: [
        { value: "none", label: "Без НДС", hint: "УСН с доходом до 20 млн ₽, освобождение по ст. 145 НК" },
        { value: "5", label: "НДС 5%", hint: "УСН, доход до 272,5 млн ₽" },
        { value: "7", label: "НДС 7%", hint: "УСН, доход до 490,5 млн ₽" },
        { value: "22", label: "НДС 22%", hint: "Общая система" },
      ] };
    },
    vatText(sum, vat) {
      if (!vat || vat === "none") return "НДС не облагается на основании ст. 145 Налогового кодекса РФ";
      const r = Number(vat);
      const tax = Math.round(sum * r / (100 + r) * 100) / 100;
      return `в том числе НДС ${r}% — ${U.money(tax)} руб.`;
    },

    // госпошлина в арбитражный суд по имущественному иску (пп. 1 п. 1 ст. 333.21 НК, ред. 259-ФЗ с 08.09.2024)
    arbFee(price) {
      const p = Math.max(0, Number(price) || 0);
      const fee = p <= 100000 ? 10000 : p <= 1e6 ? 10000 + (p - 100000) * 0.05 : p <= 1e7 ? 55000 + (p - 1e6) * 0.03 : p <= 5e7 ? 325000 + (p - 1e7) * 0.01 : 725000 + (p - 5e7) * 0.005;
      return Math.round(Math.min(fee, 1e7));
    },
    // за судебный приказ — 50% от пошлины по иску, не меньше 8 000 ₽ (пп. 3 п. 1 ст. 333.21 НК)
    arbOrderFee(price) { return Math.max(8000, Math.round(C.arbFee(price) / 2)); },

    // документооборот, претензии и подсудность в договорах между предпринимателями
    bizTermsQuestions() {
      return [
        { id: "edo", type: "choice", label: "Как обмениваться документами", options: [
          { value: "email", label: "Сканы по электронной почте", hint: "Быстро; оригиналы — по требованию" },
          { value: "edo", label: "Через ЭДО с электронной подписью (КЭП)" },
          { value: "paper", label: "Только на бумаге" },
        ] },
        { id: "claim_days", type: "choice", label: "Срок ответа на претензию до суда", hint: "Если не указать — 30 дней (ч. 5 ст. 4 АПК)", options: [
          { value: 10, label: "10 дней" }, { value: 15, label: "15 дней" }, { value: 30, label: "30 дней" },
        ] },
        { id: "court", type: "choice", label: "Где судиться", options: [
          { value: "defendant", label: "По месту нахождения ответчика", hint: "Как в законе" },
          { value: "plaintiff", label: "По месту нахождения истца", hint: "Выгодно тому, кто чаще будет требовать" },
          { value: "named", label: "В конкретном суде" },
        ] },
        { id: "court_name", type: "text", label: "Какой суд", show: a => a.court === "named", placeholder: "Арбитражный суд города Москвы" },
      ];
    },
    bizFinalClauses(a) {
      const out = [];
      out.push({
        email: "Стороны признают юридическую силу договора, приложений, дополнительных соглашений, счетов, актов, претензий и уведомлений, переданных в виде сканов подписанных документов по электронной почте с адресов, указанных в реквизитах сторон. Сообщение считается полученным в день его отправки, если отправлено в рабочий день до 18:00 по времени получателя, иначе — в следующий рабочий день. По требованию стороны оригиналы направляются почтой в течение 10 рабочих дней.",
        edo: "Договор, приложения, первичные документы, претензии и уведомления подписываются квалифицированными электронными подписями и передаются через операторов электронного документооборота. Такие документы равнозначны документам на бумаге, подписанным собственноручно (ст. 6 Федерального закона № 63-ФЗ «Об электронной подписи»).",
        paper: "Документы по договору составляются на бумаге и вручаются под подпись или направляются заказным письмом с уведомлением о вручении по адресам, указанным в реквизитах сторон.",
      }[a.edo] || F(null, "порядок обмена документами"));
      out.push(`Споры разрешаются в претензионном порядке. Спор может быть передан в суд по истечении ${F(a.claim_days, "срок")} календарных дней со дня направления претензии (ч. 5 ст. 4 АПК РФ).`);
      out.push({
        defendant: "Неурегулированные споры рассматриваются в арбитражном суде по месту нахождения ответчика.",
        plaintiff: "Неурегулированные споры рассматриваются в арбитражном суде по месту нахождения истца (ст. 37 АПК РФ).",
        named: `Неурегулированные споры передаются на рассмотрение в суд: ${F(a.court_name, "суд")} (ст. 37 АПК РФ).`,
      }[a.court] || F(null, "подсудность"));
      out.push("Изменения и дополнения к договору действительны, если совершены в письменной форме и подписаны уполномоченными представителями сторон. Во всём, что не предусмотрено договором, стороны руководствуются законодательством Российской Федерации.");
      out.push(a.edo === "edo" ? "Договор подписан в электронной форме и вступает в силу с момента подписания обеими сторонами." : "Договор составлен в двух экземплярах, по одному для каждой стороны, и вступает в силу с момента подписания.");
      return out;
    },

    // «наименование; количество; цена» построчно
    parseLines(text) {
      return String(text || "").split("\n").map(s => s.trim()).filter(Boolean).map(line => {
        const p = line.split(/\s*;\s*/);
        const num = s => { const n = Number(String(s || "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) && n > 0 ? n : null; };
        const qty = p.length >= 3 ? num(p[1]) : 1;
        const price = num(p.length >= 3 ? p[2] : p[1]);
        return { name: p[0], qty, price, sum: qty && price ? Math.round(qty * price * 100) / 100 : null, raw: line };
      });
    },

    guideSend: { title: "Вручите претензию под подпись или отправьте ценным письмом с описью вложения.", text: "На вашем экземпляре должны быть дата, подпись и должность сотрудника. Сохраните квитанцию и трек-номер." },
    guideCourt: { title: "Не выполнили в срок.", text: "Жалоба в Роспотребнадзор и иск в суд по месту вашего жительства; госпошлину потребитель не платит при цене иска до 1 млн ₽." },
  };

  global.Common = C;
})(typeof window !== "undefined" ? window : globalThis);
