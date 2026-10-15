/*
 * К-8. Калькулятор наследства по закону: кто наследует, доли, срок принятия, пошлина нотариусу.
 * Основа: ГК РФ (разд. V; после 24.07.2023 не менялся) — ст. 1114 (день открытия — день смерти), 1141 (очереди, доли
 * равные, кроме представления), 1142 (1-я: дети, супруг, родители; внуки — по представлению), 1143 (2-я: полнородные и
 * неполнородные братья и сёстры, дедушки и бабушки; племянники — по представлению), 1144 (3-я: дяди и тёти; двоюродные —
 * по представлению), 1145 (4–7-я), 1146 п. 1 (доля умершего до открытия наследника — его потомкам поровну), 1148
 * (иждивенцы), 1149 (обязательная доля — не менее половины законной), 1150 (доля пережившего супруга в общем
 * имуществе по ст. 256 в наследство не входит), 1154 п. 1 (6 месяцев), 1155 (восстановление), 1163 (свидетельство —
 * по истечении 6 месяцев), 1174 п. 3 (на похороны из вкладов — до 100 000 ₽), 1175 (долги — в пределах стоимости).
 * Сроки: ст. 191, 192 п. 3 (срок в месяцах истекает в соответствующее число), 193 (перенос с нерабочего дня).
 * НК ст. 333.24 п. 1 пп. 22 (0,3%, не более 100 000 ₽ — дети, супруг, родители, полнородные братья и сёстры; 0,6%, не
 * более 1 000 000 ₽ — другие), ст. 333.25 п. 1 пп. 5, 6 (стоимость на день открытия — рыночная, кадастровая или иная
 * по выбору), ст. 333.38 п. 1 пп. 5 (освобождения). Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const rub = n => U.money(Math.round(n)) + " ₽";
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const frac = (n, d) => { const g = gcd(n, d); return `${n / g}/${d / g}`; };
  const MAXD = 4;
  const cnt = (a, k) => { const v = Number(a[k]); return v > 0 ? Math.floor(v) : 0; };

  // представление: dead — сколько умерших до открытия наследства оставили потомков; p + i — сколько потомков у i-го
  const reprFields = (deadId, p, who, kids, show) => [
    { id: deadId, type: "number", label: `Сколько ${who} умерли раньше и оставили детей`, min: 0, max: MAXD, required: false, show, hint: `Их доля переходит их детям (${kids}) поровну` },
    ...Array.from({ length: MAXD }, (_, i) => ({ id: p + (i + 1), type: "number", min: 1, label: `Сколько детей у ${i + 1}-го из них`, show: a => show(a) && cnt(a, deadId) > i })),
  ];

  function heirs(a) {
    const list = [];
    const add = (name, n, close, extra) => { for (let i = 0; i < n; i++) list.push(Object.assign({ name: n > 1 ? `${name} ${i + 1}` : name, close }, extra || {})); };
    const withRepr = (liveName, liveN, liveClose, deadId, p, reprName) => {
      const groups = [];
      for (let i = 0; i < liveN; i++) groups.push([{ name: liveN > 1 ? `${liveName} ${i + 1}` : liveName, close: liveClose }]);
      const dead = Math.min(cnt(a, deadId), MAXD);
      for (let i = 0; i < dead; i++) {
        const m = cnt(a, p + (i + 1));
        if (m) groups.push(Array.from({ length: m }, (_, j) => ({ name: `${reprName} (через ${i + 1}-го умершего)${m > 1 ? " " + (j + 1) : ""}`, close: false, repr: m })));
      }
      return groups;
    };
    // первая очередь
    let groups = [];
    if (a.spouse === "yes") groups.push([{ name: "Супруг(а)", close: true, spouse: true, first: true }]);
    groups.push(...withRepr("Ребёнок", cnt(a, "kids"), true, "kids_dead", "gk", "Внук, внучка"));
    for (let i = 0; i < Math.min(cnt(a, "parents"), 2); i++) groups.push([{ name: cnt(a, "parents") > 1 ? `Родитель ${i + 1}` : "Родитель", close: true, first: true }]);
    groups.forEach(g => g.forEach(h => { if (!("first" in h)) h.first = true; }));
    if (groups.length) return { queue: 1, groups };
    groups = [
      ...withRepr("Брат или сестра (полнородные)", cnt(a, "sib_full"), true, "sib_dead", "nk", "Племянник, племянница"),
      ...Array.from({ length: cnt(a, "sib_half") }, (_, i) => [{ name: `Брат или сестра (неполнородные)${cnt(a, "sib_half") > 1 ? " " + (i + 1) : ""}`, close: false }]),
      ...Array.from({ length: Math.min(cnt(a, "grand"), 4) }, (_, i) => [{ name: `Дедушка или бабушка${cnt(a, "grand") > 1 ? " " + (i + 1) : ""}`, close: false }]),
    ];
    if (groups.length) return { queue: 2, groups };
    groups = withRepr("Дядя или тётя", cnt(a, "aunts"), false, "aunts_dead", "ck", "Двоюродный брат, сестра");
    if (groups.length) return { queue: 3, groups };
    return { queue: null, groups: [] };
  }

  const no1 = a => a.spouse !== "yes" && !cnt(a, "kids") && !cnt(a, "kids_dead") && !cnt(a, "parents");
  const no2 = a => no1(a) && !cnt(a, "sib_full") && !cnt(a, "sib_half") && !cnt(a, "sib_dead") && !cnt(a, "grand");

  const spec = {
    id: "k8",
    code: "К-8",
    title: "Наследство: кто наследует и сколько",
    lead: "Наследство без завещания: кто из родственников наследует, какие у кого доли, до какого числа принять наследство и сколько заплатить нотариусу.",
    status: "draft",
    defaults: { spouse: "no", marital: "yes", parents: "0" },

    fields: [
      { id: "death_date", type: "date", label: "Дата смерти", hint: "Со дня смерти идёт срок принятия наследства" },
      { id: "h1", type: "heading", label: "Первая очередь" },
      { id: "spouse", type: "choice", label: "Был ли человек в браке на день смерти?", hint: "Только зарегистрированный брак", options: [
        { value: "yes", label: "Да" },
        { value: "no", label: "Нет" },
      ] },
      { id: "marital", type: "choice", label: "Имущество куплено в браке?", show: a => a.spouse === "yes", options: [
        { value: "yes", label: "Да, всё или главное", hint: "Сначала половина — пережившему супругу, делится только вторая половина" },
        { value: "no", label: "Нет: куплено до брака, подарено или унаследовано" },
      ] },
      { id: "kids", type: "number", label: "Сколько детей живы", min: 0, required: false, hint: "В том числе усыновлённые и рождённые вне брака, если отцовство установлено" },
      ...reprFields("kids_dead", "gk", "детей", "внукам", () => true),
      { id: "parents", type: "select", label: "Сколько родителей живы", options: [
        { value: "0", label: "Ни одного" }, { value: "1", label: "Один" }, { value: "2", label: "Оба" },
      ] },
      { id: "h2", type: "heading", label: "Вторая очередь", show: no1 },
      { id: "sib_full", type: "number", label: "Сколько живы братьев и сестёр — общие мать и отец", min: 0, required: false, show: no1 },
      { id: "sib_half", type: "number", label: "Сколько живы братьев и сестёр — общий только один родитель", min: 0, required: false, show: no1 },
      ...reprFields("sib_dead", "nk", "братьев и сестёр", "племянникам", no1),
      { id: "grand", type: "number", label: "Сколько живы дедушек и бабушек", min: 0, max: 4, required: false, show: no1 },
      { id: "h3", type: "heading", label: "Третья очередь", show: no2 },
      { id: "aunts", type: "number", label: "Сколько живы дядей и тётей", min: 0, required: false, show: no2 },
      ...reprFields("aunts_dead", "ck", "дядей и тётей", "двоюродным братьям и сёстрам", no2),
      { id: "h4", type: "heading", label: "Имущество" },
      { id: "value", type: "money", label: "Сколько стоит имущество", suffix: "₽", required: false, hint: "Всё, что принадлежало умершему: квартира, машина, вклады. Для пошлины можно взять кадастровую стоимость: она обычно ниже рыночной" },
    ],

    compute(a) {
      const death = U.date(a.death_date);
      const H = heirs(a);
      if (!death && !H.groups.length) return null;
      const notes = [];
      const summary = [];
      const reminders = [];
      // срок прошёл — ведём в Д-84 (суд или согласие наследников), иначе — к нотариусу; дата смерти переносится в документ
      const rel = () => death && C.nextWorkday(U.addMonths(death, 6)) < U.today()
        ? [{ id: "d84", text: "Срок прошёл: что делать", fill: { death_date: a.death_date } }, { id: "d61", text: "Заявление нотариусу", fill: { death_date: a.death_date } }]
        : [{ id: "d61", text: "Заявление нотариусу", fill: { death_date: a.death_date } }];
      if (death) {
        const last = C.nextWorkday(U.addMonths(death, 6));
        reminders.push({ date: U.addDays(last, -14), title: "Через 2 недели истекает срок принятия наследства", text: `Заявление должно попасть к нотариусу до ${U.fmtDate(last)}.` },
          { date: last, title: "Последний день, чтобы принять наследство" },
          { date: U.addDays(last, 1), title: "Можно получать свидетельство о праве на наследство" });
        const left = U.daysBetween(U.today(), last);
        summary.push({ label: "Принять наследство до", value: U.fmtDate(last) + " включительно", big: !H.groups.length });
        if (left < 0) {
          summary.push({ label: "Срок истёк", value: `${-left} ${C.plural(-left, "день", "дня", "дней")} назад` });
          notes.push("Срок пропущен. Варианты: если вы фактически приняли наследство (жили в квартире, платили за неё, забрали вещи) — докажите это нотариусу или в суде (п. 2 ст. 1153 ГК); если не знали о смерти или была уважительная причина — иск о восстановлении срока в течение 6 месяцев после того, как причина отпала (ст. 1155); либо письменное согласие всех, кто принял наследство (п. 2 ст. 1155).");
        } else notes.push(`Осталось ${left} ${C.plural(left, "день", "дня", "дней")}. Подайте нотариусу заявление о принятии наследства (Д-61) — лично или по почте с подписью, заверенной у нотариуса (ст. 1153 ГК). Свидетельство выдадут после ${U.fmtDate(U.addMonths(death, 6))}.`);
      }
      if (!H.groups.length) {
        if (death) notes.push("Наследников первых трёх очередей нет. Наследовать могут дальние родственники (4–7 очереди, ст. 1145 ГК) или нетрудоспособные иждивенцы (ст. 1148). Если никого нет — имущество выморочное и переходит государству или муниципалитету (ст. 1151).");
        return death ? { summary, notes, reminders, related: rel() } : null;
      }
      const n = H.groups.length;
      const value = typeof a.value === "number" && a.value > 0 ? a.value : null;
      const half = a.spouse === "yes" && a.marital === "yes";
      const estate = value ? (half ? value / 2 : value) : null;
      const rows = [];
      let dutyTotal = 0;
      H.groups.forEach(g => g.forEach(h => {
        const m = g.length;
        const share = [1, n * m];
        const cells = [h.name, frac(1, n * m)];
        if (half) cells.push(h.spouse ? `1/2 + ${frac(1, n * m * 2)} = ${frac(n * m + 1, n * m * 2)}` : frac(1, n * m * 2));
        if (estate) {
          const amt = estate * share[0] / share[1];
          const rate = h.close ? 0.003 : 0.006, cap = h.close ? 100000 : 1000000;
          const duty = Math.round(Math.min(cap, amt * rate));
          dutyTotal += duty;
          cells.push(rub(amt + (h.spouse && half ? value / 2 : 0)), rub(duty));
        }
        rows.push(cells);
      }));
      const head = ["Наследник", "Доля в наследстве"];
      if (half) head.push("Доля во всём имуществе");
      if (estate) head.push("Получит", "Пошлина нотариусу");
      summary.unshift({ label: "Наследуют", value: `${["первая", "вторая", "третья"][H.queue - 1]} очередь — ${rows.length} ${C.plural(rows.length, "человек", "человека", "человек")}` });
      if (estate) summary.push({ label: "Пошлина за свидетельства, всего", value: rub(dutyTotal) });
      if (death) summary.find(s => s.label.startsWith("Принять")).big = true;

      if (half) notes.push("Имущество, нажитое в браке, общее. Половина принадлежит пережившему супругу сама по себе — её не наследуют (ст. 1150 ГК, ст. 34 СК). Нотариус выдаст на неё отдельное свидетельство по заявлению супруга. Делится только половина умершего.");
      if (cnt(a, "kids_dead") || cnt(a, "sib_dead") || cnt(a, "aunts_dead")) notes.push("Доля родственника, который умер раньше наследодателя, переходит его детям поровну — это наследование по праву представления (ст. 1146 ГК).");
      if (H.queue === 1) notes.push("Если есть завещание, наследуют по нему. Но несовершеннолетние и нетрудоспособные дети, нетрудоспособные супруг и родители всё равно получат не меньше половины своей доли по закону — обязательную долю (ст. 1149 ГК).");
      notes.push(
        "Кто-то из наследников может отказаться — тогда его доля делится между остальными или переходит тому, в чью пользу он отказался (ст. 1158, 1161 ГК).",
        "Нетрудоспособные, которые не меньше года жили на иждивении умершего, наследуют наравне с этой очередью (ст. 1148 ГК) — в таблице они не учтены.",
        "Долги умершего переходят к наследникам, но каждый отвечает только в пределах стоимости того, что получил (ст. 1175 ГК).",
        "На похороны банк выдаст до 100 000 ₽ со вкладов умершего по постановлению нотариуса — не дожидаясь 6 месяцев (п. 3 ст. 1174 ГК).",
      );
      if (estate) notes.push("Пошлина — 0,3% стоимости (не больше 100 000 ₽) для детей, супруга, родителей, полнородных братьев и сестёр, 0,6% (не больше 1 000 000 ₽) — для остальных (пп. 22 п. 1 ст. 333.24 НК). Стоимость — на день смерти: рыночная, кадастровая или иная, по вашему выбору. Не платят за жильё, в котором жили вместе с умершим и живёте дальше, за вклады, а также несовершеннолетние (ст. 333.38 НК). Отдельно нотариус берёт плату за техническую работу — по тарифам своей палаты.");
      return {
        summary,
        table: { head, rows },
        notes,
        reminders,
        related: rel(),
      };
    },
  };

  spec.heirs = heirs;
  global.CALCS = global.CALCS || {};
  global.CALCS.k8 = spec;
})(typeof window !== "undefined" ? window : globalThis);
