/*
 * Д-13. Акт приёма-передачи жилого помещения с описью имущества (к договору найма Д-12).
 * Два режима: передача при заселении и возврат при выезде.
 * Основа: ст. 676 (передача в пригодном состоянии), 678, 681 ГК РФ; ст. 381.1 ГК (обеспечительный платёж).
 * Опись вводится построчно: «Название; количество; состояние».
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const F = U.F;

  // «Диван угловой; 1; хорошее, пятно на подлокотнике» → {name, qty, cond}
  function parseInventory(text) {
    return String(text || "").split("\n").map(s => s.trim()).filter(Boolean).map(line => {
      const parts = line.split(/\s*[;|]\s*/);
      const name = parts[0] || "";
      const qty = parts[1] && /^\d+$/.test(parts[1]) ? Number(parts[1]) : 1;
      const cond = (parts[1] && !/^\d+$/.test(parts[1]) ? parts.slice(1) : parts.slice(2)).join(", ");
      return { name, qty, cond };
    }).filter(x => x.name);
  }

  function derive(a) {
    const items = parseInventory(a.inventory);
    const act = U.date(a.act_date);
    const deduction = typeof a.deduction === "number" && a.deduction > 0 ? a.deduction : 0;
    const deposit = typeof a.deposit === "number" ? a.deposit : null;
    const toReturn = deposit != null ? Math.max(0, deposit - deduction) : null;
    return { items, act, deduction, deposit, toReturn, returnMode: a.mode === "return" };
  }

  const METERS = [
    { id: "m_el", label: "Электроэнергия, кВт·ч" },
    { id: "m_cold", label: "Холодная вода, м³" },
    { id: "m_hot", label: "Горячая вода, м³" },
    { id: "m_gas", label: "Газ, м³" },
  ];

  const spec = {
    id: "d13",
    code: "Д-13",
    title: "Акт приёма-передачи квартиры с описью имущества",
    lead: "Приложение к договору найма: фиксирует состояние жилья, мебель и технику, показания счётчиков и ключи — при заселении и при выезде. Главная защита залога. Займёт около 10 минут.",
    status: "draft",
    disclaimer: "Акт составлен по вашим ответам. Заполняйте его вместе, прямо в квартире, и подписывайте после осмотра.",

    steps: [
      {
        id: "base", title: "Основное",
        questions: [
          { id: "mode", type: "choice", label: "Какой акт нужен?", options: [
            { value: "transfer", label: "При заселении", hint: "Собственник передаёт жильё жильцу" },
            { value: "return", label: "При выезде", hint: "Жилец возвращает жильё собственнику" },
          ] },
          { id: "contract_date", type: "date", label: "Дата договора найма" },
          { id: "address", type: "text", label: "Адрес", placeholder: "г. Москва, ул. Ленина, д. 5, кв. 7" },
          { id: "act_date", type: "date", label: "Дата акта" },
          { id: "keys", type: "number", label: "Сколько комплектов ключей?", min: 0 },
          { id: "keys_desc", type: "text", label: "Что в комплекте?", required: false, placeholder: "ключ от входной двери, домофонный чип, ключ от почтового ящика" },
        ],
      },
      {
        id: "state", title: "Состояние",
        questions: [
          { id: "condition", type: "choice", label: "Общее состояние жилья", options: [
            { value: "good", label: "Хорошее, пригодно для проживания" },
            { value: "defects", label: "Пригодно, но есть недостатки" },
          ] },
          { id: "defects", type: "textarea", label: "Какие недостатки?", hint: "Каждый с новой строки: где и что. Например: «Кухня — скол плитки у мойки»", show: a => a.condition === "defects" },
          ...METERS.map(m => ({ id: m.id, type: "number", label: m.label, required: false, min: 0 })),
          { id: "photos", type: "choice", label: "Сделаны фотографии и видео состояния?", options: [
            { value: "yes", label: "Да" }, { value: "no", label: "Нет" },
          ] },
        ],
      },
      {
        id: "inventory", title: "Опись",
        lead: "Каждая вещь с новой строки: название; количество; состояние. Например: «Холодильник Samsung; 1; исправен, царапина на двери».",
        questions: [
          { id: "inventory", type: "textarea", label: "Мебель и техника", placeholder: "Диван угловой; 1; хорошее\nХолодильник Samsung; 1; исправен\nСтулья; 4; хорошее" },
        ],
      },
      {
        id: "return", title: "Расчёт при выезде",
        lead: "Этот шаг нужен только для выезда.",
        questions: [
          { id: "ret_damage", type: "choice", label: "При возврате обнаружен ущерб сверх обычного износа?", show: a => a.mode === "return", options: [
            { value: "no", label: "Нет" }, { value: "yes", label: "Да" },
          ] },
          { id: "ret_damage_desc", type: "textarea", label: "Какой ущерб?", show: a => a.mode === "return" && a.ret_damage === "yes" },
          { id: "deposit", type: "money", label: "Сумма залога по договору", suffix: "₽", required: false, show: a => a.mode === "return" },
          { id: "deduction", type: "money", label: "Сколько удерживается из залога?", hint: "Ущерб и долги по оплате, если есть. 0 — если ничего", suffix: "₽", min: 0, show: a => a.mode === "return" && typeof a.deposit === "number",
            validate: (v, a) => a.deposit != null && v > a.deposit ? "Не больше суммы залога" : null },
          { id: "deduction_reason", type: "text", label: "За что удержание?", placeholder: "Замена разбитой столешницы по чеку — 8 000 ₽", show: a => a.mode === "return" && typeof a.deduction === "number" && a.deduction > 0 },
          { id: "note", type: "text", label: "Что-то ещё записать в акт?", required: false, show: a => a.mode !== "return" },
        ],
      },
      {
        id: "parties", title: "Стороны",
        questions: [
          { id: "ll_name", type: "text", label: "ФИО собственника (наймодателя)" },
          { id: "tn_name", type: "text", label: "ФИО жильца (нанимателя)" },
        ],
      },
    ],

    derive,

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      const ret = d.returnMode;
      P.push({ text: `Приложение № 1\nк договору найма жилого помещения от ${F(U.fmtDate(U.date(a.contract_date)), "дата договора")}`, align: "right", after: 240 });
      P.push({ text: "АКТ", align: "center", bold: true, after: 0 });
      P.push({ text: ret ? "возврата жилого помещения и имущества" : "приёма-передачи жилого помещения и имущества", align: "center", after: 240 });
      P.push({ text: `${F(U.fmtDate(d.act), "дата акта")}`, align: "right", after: 240 });

      const from = ret ? `Наниматель ${F(a.tn_name, "ФИО нанимателя")}` : `Наймодатель ${F(a.ll_name, "ФИО наймодателя")}`;
      const to = ret ? `Наймодатель ${F(a.ll_name, "ФИО наймодателя")}` : `Наниматель ${F(a.tn_name, "ФИО нанимателя")}`;
      T(`${from} передал(а), а ${to} принял(а) жилое помещение по адресу: ${F(a.address, "адрес")} (далее — Помещение), а также находящееся в нём имущество.`);

      if (a.condition === "good") T(ret ? "1. Помещение возвращено в состоянии, в котором было получено, с учётом нормального износа." : "1. Помещение находится в состоянии, пригодном для проживания. Санитарно-техническое, электрическое и иное оборудование исправно.");
      else if (a.condition === "defects") T(`1. Помещение ${ret ? "возвращено" : "пригодно для проживания"}. При осмотре выявлены следующие недостатки:\n` + String(a.defects || "").split("\n").map(s => s.trim()).filter(Boolean).map(s => "— " + s).join("\n"));
      else T(F(null, "состояние Помещения"));

      const meters = METERS.filter(m => typeof a[m.id] === "number").map(m => `${m.label}: ${a[m.id]}`);
      T("2. Показания приборов учёта на дату акта:" + (meters.length ? "\n" + meters.map(s => "— " + s).join("\n") : " не сняты."));
      T(`3. Передано комплектов ключей: ${F(a.keys, "количество")}` + (a.keys_desc ? ` (${a.keys_desc})` : "") + ".");

      T("4. Опись имущества:" + (d.items.length ? "\n" + d.items.map((x, i) => `${i + 1}. ${x.name} — ${x.qty} шт.${x.cond ? " — " + x.cond : ""}`).join("\n") : " " + F(null, "опись")));

      if (a.photos === "yes") T("5. Состояние Помещения и имущества зафиксировано на фото- и видеосъёмке, файлы хранятся у обеих сторон и являются неотъемлемой частью акта.");
      if (ret) {
        if (a.ret_damage === "yes") T(`6. При возврате обнаружен ущерб сверх нормального износа: ${F(a.ret_damage_desc, "ущерб")}.`);
        else if (a.ret_damage === "no") T("6. Ущерба Помещению и имуществу сверх нормального износа не обнаружено. Стороны претензий друг к другу по состоянию Помещения и имущества не имеют.");
        if (d.deposit != null) {
          if (d.deduction > 0) T(`7. Из обеспечительного платежа в размере ${U.money(d.deposit)} руб. удерживается ${U.money(d.deduction)} руб. (${F(a.deduction_reason, "основание удержания")}). Возврату Нанимателю подлежит ${U.money(d.toReturn)} руб. (ст. 381.1 ГК РФ).`);
          else T(`7. Обеспечительный платёж в размере ${U.money(d.deposit)} руб. подлежит возврату Нанимателю в полном объёме (ст. 381.1 ГК РФ).`);
        }
      } else if (a.note) T(`5.1. ${a.note}`);

      T("Акт составлен в двух экземплярах, по одному для каждой стороны.");
      P.push({ text: `Передал(а): ____________ / ${F(U.shortName(ret ? a.tn_name : a.ll_name), "И. О. Фамилия")}\n\nПринял(а): ____________ / ${F(U.shortName(ret ? a.ll_name : a.tn_name), "И. О. Фамилия")}`, align: "left", before: 360 });
      return P;
    },

    guidance(a, d) {
      const g = [
        { title: "Заполняйте акт вместе и прямо в квартире.", text: "Проверьте каждую вещь: включите технику, откройте краны, посмотрите окна и двери." },
        { title: "Снимите видео обхода квартиры с датой.", text: "Медленно, каждую комнату и каждую крупную вещь. Отправьте видео друг другу в мессенджер — так останется подтверждение даты." },
        { title: "Сфотографируйте счётчики.", text: "Показания в акте и на фото должны совпадать." },
      ];
      if (d.returnMode) g.push({ title: "Удержание из залога — только за реальный ущерб.", text: "Обычный износ (потёртости, выгоревшие обои) не повод удерживать деньги. Удержание должно быть подтверждено чеком или сметой. Залог возвращается в срок, который указан в договоре." });
      return g;
    },

    fileName(a) { return (a.mode === "return" ? "Акт возврата квартиры" : "Акт приёма-передачи квартиры") + (a.address ? " — " + String(a.address).slice(0, 40) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d13 = spec;
})(typeof window !== "undefined" ? window : globalThis);
