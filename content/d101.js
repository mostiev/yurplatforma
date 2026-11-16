/*
 * Д-101. Заявление работодателю о стандартном вычете на детей (+ заявление второго родителя об отказе в пользу
 * первого).
 * Основа: НК РФ — пп. 4 п. 1 ст. 218 (1 400 руб. — первый ребёнок, 2 800 — второй, 6 000 — третий и каждый
 * следующий; ребёнок-инвалид — дополнительно 12 000 руб. родителю, 6 000 — опекуну; до 18 лет или до 24 лет при
 * очном обучении; в двойном размере — единственному родителю или если второй отказался), п. 3 ст. 218
 * (у одного налогового агента по заявлению и документам), п. 4 ст. 218 (через ФНС — при подаче декларации),
 * лимит дохода 450 000 руб. с начала года (176-ФЗ с 01.01.2025; с 2026 г. — только доходы основной налоговой базы,
 * 425-ФЗ от 28.11.2025).
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;
  const LIMIT = 450000;

  function age(b, at) { if (!b) return null; let y = at.getFullYear() - b.getFullYear(); if (at.getMonth() < b.getMonth() || (at.getMonth() === b.getMonth() && at.getDate() < b.getDate())) y--; return y; }

  function derive(a) {
    const today = U.today();
    // порядок детей — по дате рождения, учитываются все дети, в том числе взрослые (вычет на них не дают, но очерёдность считается)
    const kids = U.rows(a.children).map(r => ({ name: r.name, birth: U.date(r.birth), status: r.status || "minor" })).filter(k => k.name && k.birth)
      .sort((x, y) => x.birth - y.birth);
    const guardian = a.who === "guardian";
    kids.forEach((k, i) => {
      k.order = i + 1;
      k.age = age(k.birth, today);
      k.eligible = k.age < 18 || (k.status === "student" && k.age < 24) || (k.status === "disabled" && k.age < 18) || (k.status === "disabled_student" && k.age < 24);
      k.base = k.order === 1 ? 1400 : k.order === 2 ? 2800 : 6000;
      k.dis = /disabled/.test(k.status) ? (guardian ? 6000 : 12000) : 0;
      k.sum = k.eligible ? k.base + k.dis : 0;
    });
    const double = a.double === "single" || a.double === "refused";
    const monthly = kids.reduce((s, k) => s + k.sum, 0) * (double ? 2 : 1);
    const salary = Number(a.salary) || 0;
    const months = salary > 0 ? Math.min(12, Math.floor(LIMIT / salary)) : 12; // месяцев, пока доход с начала года не превысит лимит
    const saveMonth = Math.round(monthly * 0.13);
    return { kids, double, monthly, months, saveMonth, saveYear: saveMonth * months, guardian, refusal: a.double === "refused" };
  }

  const STATUS = [
    { value: "minor", label: "До 18 лет" }, { value: "student", label: "Студент очно до 24" },
    { value: "disabled", label: "Инвалидность, до 18" }, { value: "disabled_student", label: "Инвалидность I–II гр., студент до 24" }, { value: "adult", label: "Взрослый" },
  ];

  const spec = {
    id: "d101",
    code: "Д-101",
    title: "Заявление на вычет на детей",
    lead: "Работодатель будет удерживать меньше НДФЛ: 1 400 ₽ на первого ребёнка, 2 800 ₽ на второго, 6 000 ₽ на третьего, пока доход с начала года не дошёл до 450 000 ₽. Посчитаем вычет и составим заявление. Займёт около 3 минут.",
    status: "draft",
    actual: "17.11.2026",
    defaults: { who: "parent", double: "no" },

    steps: [
      {
        id: "kids", title: "Дети",
        questions: [
          { id: "who", type: "choice", label: "Вы", options: [{ value: "parent", label: "Родитель или его супруг(а)" }, { value: "guardian", label: "Опекун, попечитель, приёмный родитель" }] },
          { id: "children", type: "rows", label: "Все ваши дети, включая взрослых", hint: "Очерёдность считается по возрасту среди всех детей. На взрослого вычета нет, но он влияет на размер для младших", max: 10, addLabel: "+ Добавить ребёнка",
            columns: [{ id: "name", label: "ФИО", required: true, w: "2fr" }, { id: "birth", label: "Дата рождения", type: "date", required: true, w: "1fr" }, { id: "status", label: "Статус", type: "select", options: STATUS, required: true, w: "1fr" }] },
          { id: "double", type: "choice", label: "Вычет в двойном размере?", options: [
            { value: "no", label: "Нет" },
            { value: "single", label: "Я единственный родитель", hint: "Второй родитель умер, признан безвестно отсутствующим; в браке — уже не единственный" },
            { value: "refused", label: "Второй родитель отказывается от вычета в мою пользу", hint: "Добавим его заявление об отказе. У него должен быть доход по ставке 13%" },
          ] },
          { id: "other_name", type: "text", label: "Второй родитель — ФИО", show: a => a.double === "refused" },
          { id: "other_work", type: "text", label: "Его место работы", show: a => a.double === "refused", placeholder: "ООО «Вектор»" },
          { id: "salary", type: "money", label: "Ваша зарплата в месяц до вычета НДФЛ", suffix: "₽", required: false, hint: "Посчитаем, сколько месяцев в году будет действовать вычет" },
        ],
      },
      {
        id: "you", title: "Работа",
        questions: [
          { id: "org_name", type: "text", label: "Работодатель", placeholder: "ООО «Ромашка»" },
          { id: "head_position", type: "text", label: "Должность руководителя", placeholder: "Генеральному директору" },
          { id: "head_name", type: "text", label: "ФИО руководителя", placeholder: "Иванову И. И." },
          { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
          { id: "position", type: "text", label: "Ваша должность", required: false },
          { id: "from_month", type: "select", label: "С какого месяца", options: ["января", "текущего месяца"].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })), hint: "Работодатель может пересчитать НДФЛ с начала года, если вы работали у него с января" },
        ],
      },
    ],

    derive,

    stop(a, d) {
      if (d.kids.length && !d.kids.some(k => k.eligible)) return { title: "Вычет не положен.", text: "Вычет дают на детей до 18 лет и на студентов-очников до 24 лет. Если ребёнок старше — проверьте социальные вычеты за его обучение или лечение.", link: { href: "k6.html", text: "Калькулятор вычета за учёбу и лечение →" } };
      return null;
    },

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      const year = U.today().getFullYear();
      P.push({ text: `${F(a.head_position, "Должность руководителя")} ${F(a.org_name, "работодатель")}\n${F(a.head_name, "ФИО руководителя")}\nот ${F(a.buyer_name, "ваши ФИО")}` + (a.position ? `\n${a.position}` : ""), align: "left", leftIndent: 4500, after: 360 });
      C.title(P, "ЗАЯВЛЕНИЕ", "о предоставлении стандартного налогового вычета на детей");
      const list = d.kids.filter(k => k.eligible).map(k => `— ${k.name}, ${U.fmtDate(k.birth)} г. р. (${k.order}-й ребёнок${k.status === "student" || k.status === "disabled_student" ? ", обучается очно" : ""}${k.dis ? ", ребёнок-инвалид" : ""}): ${U.money(k.sum * (d.double ? 2 : 1))} руб. в месяц;`).join("\n").replace(/;$/, ".");
      T(`В соответствии с пп. 4 п. 1 и п. 3 ст. 218 Налогового кодекса РФ прошу предоставлять мне с ${a.from_month === "января" ? `января ${year}` : "текущего месяца"} г. стандартный налоговый вычет по НДФЛ на ${d.kids.filter(k => k.eligible).length > 1 ? "детей" : "ребёнка"}${d.double ? " в двойном размере" : ""}:\n${list || F(null, "дети")}`);
      if (d.kids.some(k => !k.eligible)) T(`Также у меня есть ${d.kids.filter(k => !k.eligible).map(k => `${k.name} (${U.fmtDate(k.birth)} г. р.)`).join(", ")} — учитывается при определении очерёдности детей.`);
      if (a.double === "single") T("Я являюсь единственным родителем (ст. 218 НК РФ). Обязуюсь сообщить о вступлении в брак.");
      if (d.refusal) T(`Второй родитель — ${F(a.other_name, "ФИО")} — отказывается от получения вычета в мою пользу (заявление прилагается). Обязуюсь ежемесячно представлять справку о его доходах, облагаемых по ставке 13%.`);
      T("Обязуюсь сообщить об изменении обстоятельств, влияющих на право на вычет. Вычет на детей другим работодателем мне не предоставляется.");
      C.attachments(P, [
        d.kids.filter(k => k.eligible).length > 1 ? "Копии свидетельств о рождении детей." : "Копия свидетельства о рождении ребёнка.",
        ...(d.kids.some(k => k.eligible && /student/.test(k.status)) ? ["Справка с места учёбы об очном обучении."] : []),
        ...(d.kids.some(k => k.eligible && k.dis) ? ["Справка об инвалидности ребёнка."] : []),
        ...(d.guardian ? ["Документ об опеке (попечительстве) или договор о приёмной семье."] : []),
        ...(a.double === "single" ? ["Документ, подтверждающий, что я единственный родитель (свидетельство о смерти второго родителя, решение суда и т. п.)."] : []),
        ...(d.refusal ? ["Заявление второго родителя об отказе от вычета.", "Справка о доходах второго родителя."] : []),
      ]);
      C.sign(P, a);
      if (d.refusal) {
        P.push({ pageBreak: true });
        P.push({ text: `Руководителю ${F(a.other_work, "место работы второго родителя")}\nот ${F(a.other_name, "ФИО второго родителя")}`, align: "left", leftIndent: 4500, after: 360 });
        C.title(P, "ЗАЯВЛЕНИЕ", "об отказе от стандартного налогового вычета на детей");
        T(`Отказываюсь от получения стандартного налогового вычета по НДФЛ на ${d.kids.filter(k => k.eligible).map(k => `${k.name} (${U.fmtDate(k.birth)} г. р.)`).join(", ") || F(null, "детей")} в пользу второго родителя — ${F(a.buyer_name, "ФИО")} (пп. 4 п. 1 ст. 218 НК РФ). Прошу ежемесячно выдавать мне справку о доходах для представления по месту работы второго родителя.`);
        P.push({ text: `«___» ____________ 20__ г.            ____________ / ${F(U.shortName(a.other_name), "И. О. Фамилия")}`, align: "left", before: 360 });
      }
      return P;
    },

    guidance(a, d) {
      const g = [];
      g.push({ title: `Экономия — около ${U.money(d.saveMonth)} ₽ в месяц.`, text: `Вычет ${U.money(d.monthly)} ₽ уменьшает доход, с которого удерживают 13%.` + (Number(a.salary) ? ` При вашей зарплате он будет действовать ${d.months} ${C.plural(d.months, "месяц", "месяца", "месяцев")} в году — пока доход с начала года не превысит 450 000 ₽; за год — около ${U.money(d.saveYear)} ₽.` : " Вычет действует, пока доход с начала года не превысит 450 000 ₽; с 2026 года считаются только доходы основной базы — районный коэффициент и северная надбавка, например, не входят.") });
      g.push({ title: "Отдайте заявление в бухгалтерию с копиями документов.", text: "Достаточно один раз; новое — если родится ребёнок или изменятся обстоятельства. Вычет дают только у одного работодателя." });
      g.push({ title: "Не получали вычет раньше?", text: "За прошлые 3 года его можно вернуть через налоговую: декларация 3-НДФЛ в личном кабинете на nalog.ru." });
      return g;
    },

    fileName() { return "Заявление на стандартный вычет на детей"; },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d101 = spec;
})(typeof window !== "undefined" ? window : globalThis);
