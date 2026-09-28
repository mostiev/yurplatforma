/*
 * Д-10. Претензия автосервису: плохой ремонт, сорванный срок, повреждение машины, работы без согласия.
 * Основа: ст. 28 (сроки), 29, 31 (качество), 35 (сохранность вещи потребителя), пп. 6 п. 2 ст. 16 (работы без согласия)
 * Закона РФ № 2300-1; Правила оказания услуг по ТО и ремонту автомототранспортных средств, утв. ПП РФ от 29.05.2025 № 780
 * (действуют с 01.09.2025, заменили ПП № 290). Пункты ПП № 780 не цитируем: полный текст не сверен.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  const SITUATIONS = {
    quality: "Отремонтировали плохо — неисправность осталась или появилась новая",
    delay: "Затянули ремонт — не отдали машину в срок",
    damage: "Повредили машину, пока она была в сервисе",
    extra: "Сделали и включили в счёт работы, которые я не заказывал(а)",
  };

  function derive(a) {
    const deadline = U.date(a.deadline_date);
    const today = U.today();
    const lateDays = deadline && today > deadline ? U.daysBetween(deadline, today) : 0;
    const price = typeof a.price === "number" ? a.price : null;
    const penalty = price != null && lateDays ? Math.min(Math.round(price * 0.03 * lateDays * 100) / 100, price) : null;
    const refundOk = a.essential === "yes" || a.fix_failed === "yes";
    return { deadline, today, lateDays, price, penalty, refundOk };
  }

  const spec = {
    id: "d10",
    code: "Д-10",
    title: "Претензия автосервису",
    lead: "Плохой ремонт, сорванные сроки, царапины после сервиса или лишние работы в счёте. Займёт около 7 минут.",
    status: "draft",

    steps: [
      {
        id: "what", title: "Ситуация",
        questions: [
          { id: "situation", type: "choice", label: "Что случилось?", options: Object.entries(SITUATIONS).map(([value, label]) => ({ value, label })) },
          { id: "defect", type: "textarea", label: "Что не так после ремонта?", placeholder: "После замены сцепления педаль уходит в пол, на второй передаче рывки", show: a => a.situation === "quality" },
          { id: "fix_failed", type: "choice", label: "Вы уже просили исправить, а сервис не исправил в срок?", show: a => a.situation === "quality",
            options: [{ value: "yes", label: "Да" }, { value: "no", label: "Нет, обращаюсь впервые" }] },
          { id: "essential", type: "choice", label: "Недостаток серьёзный?", hint: "Серьёзный — если его нельзя исправить, исправление слишком дорогое или долгое, или он вернулся после исправления", show: a => a.situation === "quality",
            options: [{ value: "yes", label: "Да" }, { value: "no", label: "Нет" }, { value: "unknown", label: "Не уверен(а)" }] },
          { id: "demand", type: "choice", label: "Чего вы хотите?", show: a => a.situation === "quality",
            options: [
              { value: "fix", label: "Бесплатно исправить" },
              { value: "price_cut", label: "Уменьшить цену ремонта" },
              { value: "costs", label: "Возместить расходы на исправление в другом сервисе" },
              { value: "refund", label: "Отказаться от договора и вернуть деньги", disabled: (a, d) => d.refundOk ? null : "Можно, если недостаток серьёзный или сервис уже не исправил в срок" },
            ] },
          { id: "fix_days", type: "number", label: "За сколько дней исправить?", suffix: "дн.", min: 1, show: a => a.situation === "quality" && a.demand === "fix" },
          { id: "amount", type: "money", label: "На сколько уменьшить цену?", suffix: "₽", min: 1, show: a => a.situation === "quality" && a.demand === "price_cut" },
          { id: "amount", type: "money", label: "Сколько заплатили другому сервису?", suffix: "₽", min: 1, show: a => a.situation === "quality" && a.demand === "costs" },
          { id: "deadline_date", type: "date", label: "Какой срок ремонта был в заказ-наряде?", show: a => a.situation === "delay" },
          { id: "delay_demand", type: "choice", label: "Чего вы хотите?", show: a => a.situation === "delay", options: [
            { value: "new_term", label: "Закончить ремонт в новый срок" },
            { value: "refuse", label: "Отказаться от ремонта, вернуть деньги и машину" },
          ] },
          { id: "new_days", type: "number", label: "Сколько дней дать на завершение?", suffix: "дн.", min: 1, show: a => a.delay_demand === "new_term" },
          { id: "damage_desc", type: "textarea", label: "Какие повреждения?", placeholder: "Царапина на переднем правом крыле длиной 15 см, скол лака на бампере", show: a => a.situation === "damage" },
          { id: "damage_in_act", type: "choice", label: "Повреждения записаны в акте при приёмке машины?", show: a => a.situation === "damage",
            options: [{ value: "yes", label: "Да, записали при выдаче" }, { value: "no", label: "Нет, заметил(а) позже" }] },
          { id: "damage_cost", type: "money", label: "Во сколько оценивается ремонт повреждений?", hint: "По смете другого сервиса или оценщика", suffix: "₽", min: 1, show: a => a.situation === "damage" },
          { id: "extra_desc", type: "textarea", label: "Какие работы сделали без согласия?", placeholder: "Замена тормозных колодок и антифриза — не было в заказ-наряде, со мной не согласовывали", show: a => a.situation === "extra" },
          { id: "extra_sum", type: "money", label: "Сколько они стоили?", suffix: "₽", min: 1, show: a => a.situation === "extra" },
          { id: "extra_paid", type: "choice", label: "Вы уже заплатили за них?", show: a => a.situation === "extra",
            options: [{ value: "yes", label: "Да, пришлось, чтобы забрать машину" }, { value: "no", label: "Нет" }] },
        ],
      },
      {
        id: "order", title: "Заказ",
        questions: [
          { id: "car", type: "text", label: "Автомобиль", placeholder: "Kia Rio, госномер А123ВС777" },
          { id: "order_no", type: "text", label: "Номер заказ-наряда", required: false },
          { id: "order_date", type: "date", label: "Дата заказ-наряда (когда сдали машину)" },
          { id: "works", type: "text", label: "Какие работы заказывали?", placeholder: "Замена сцепления" },
          { id: "price", type: "money", label: "Стоимость работ по заказ-наряду", suffix: "₽", min: 1 },
          C.refundQuestion(a => (a.situation === "quality" && ["price_cut", "costs", "refund"].includes(a.demand)) || a.delay_demand === "refuse" || a.situation === "damage" || (a.situation === "extra" && a.extra_paid === "yes")),
        ],
      },
      {
        id: "parties", title: "Стороны",
        questions: [
          { id: "org_name", type: "text", label: "Автосервис", placeholder: "ООО «Автомастер»" },
          C.innQuestion("org_inn"),
          { id: "org_address", type: "text", label: "Адрес автосервиса" },
          ...C.personQuestions(),
        ],
      },
    ],

    derive,

    stop(a, d) {
      if (a.situation === "delay" && d.deadline && d.today <= d.deadline) return { title: "Срок ремонта ещё не прошёл", text: `По заказ-наряду сервис может закончить до ${U.fmtDate(d.deadline)}. Если не успеет, возвращайтесь.` };
      return null;
    },

    render(a, d) {
      const refund = C.refundText(a.refund_method);
      const rules = "Правилами оказания услуг (выполнения работ) по техническому обслуживанию и ремонту автомототранспортных средств, утв. постановлением Правительства РФ от 29.05.2025 № 780";
      const P = [];
      C.header({ name: a.org_name, nameLabel: "автосервис", inn: a.org_inn, address: a.org_address }, C.from(a), P);
      const sub = { quality: "о недостатках выполненных работ", delay: "о нарушении сроков выполнения работ", damage: "о возмещении ущерба, причинённого автомобилю", extra: "о работах, выполненных без согласия" }[a.situation] || "";
      C.title(P, "ПРЕТЕНЗИЯ", sub);

      P.push({ text: `${F(U.fmtDate(U.date(a.order_date)), "дата")} я передал(а) вам автомобиль ${F(a.car, "автомобиль")} для выполнения работ: ${F(a.works, "работы")}` + (a.order_no ? ` (заказ-наряд № ${a.order_no})` : "") + `. Стоимость работ — ${F(U.money(a.price), "сумма")} руб. Отношения сторон регулируются ${C.LAW_ZOZPP}, и ${rules}.`, indent: true });

      if (a.situation === "quality") {
        P.push({ text: `После выполнения работ обнаружены недостатки: ${F(a.defect, "недостатки")}.` + (a.fix_failed === "yes" ? " Ранее я требовал(а) их устранить, но в установленный срок они устранены не были." : "") + (a.essential === "yes" && a.demand === "refund" ? " Недостатки являются существенными." : ""), indent: true });
        P.push({ text: "На основании ст. 29 Закона ТРЕБУЮ:", indent: true, keepNext: true });
        P.push({ text: {
          fix: `безвозмездно устранить недостатки выполненных работ в течение ${F(a.fix_days, "срок")} дней со дня получения претензии (ст. 30 Закона).`,
          price_cut: `уменьшить цену выполненных работ на ${F(U.money(a.amount), "сумма")} руб. и вернуть эту сумму ${refund} в течение 10 дней (п. 1 ст. 31 Закона).`,
          costs: `возместить расходы на устранение недостатков третьими лицами в сумме ${F(U.money(a.amount), "сумма")} руб. ${refund} в течение 10 дней (п. 1 ст. 31 Закона).`,
          refund: `принять отказ от исполнения договора и вернуть уплаченную сумму ${F(U.money(a.price), "сумма")} руб. ${refund} в течение 10 дней (п. 1 ст. 31 Закона).`,
        }[a.demand] || F(null, "требование"), indent: true });
        P.push({ text: C.courtThreat("penalty3"), indent: true });
      }
      if (a.situation === "delay") {
        P.push({ text: `Срок выполнения работ по заказ-наряду истёк ${F(U.fmtDate(d.deadline), "дата")}; просрочка на сегодня составляет ${d.lateDays} дн. За каждый день просрочки исполнитель уплачивает неустойку в размере 3% цены работ, но не более цены работ (п. 5 ст. 28 Закона); на сегодня это ${F(U.money(d.penalty), "сумма")} руб.`, indent: true });
        P.push({ text: "На основании п. 1 ст. 28 Закона ТРЕБУЮ:", indent: true, keepNext: true });
        if (a.delay_demand === "new_term") P.push({ text: `1. Завершить работы и передать мне автомобиль в новый срок — в течение ${F(a.new_days, "срок")} дней со дня получения претензии.\n2. Выплатить неустойку за нарушение срока.`, indent: true });
        else P.push({ text: `1. Принять мой отказ от исполнения договора и вернуть автомобиль.\n2. Вернуть уплаченные за работы денежные средства ${refund} в течение 10 дней (п. 1 ст. 31 Закона).\n3. Выплатить неустойку за нарушение срока.`, indent: true });
        P.push({ text: C.courtThreat("none"), indent: true });
      }
      if (a.situation === "damage") {
        P.push({ text: `Во время нахождения автомобиля у вас ему были причинены повреждения: ${F(a.damage_desc, "повреждения")}.` + (a.damage_in_act === "yes" ? " Повреждения зафиксированы при приёмке автомобиля." : "") + ` Стоимость их устранения составляет ${F(U.money(a.damage_cost), "сумма")} руб. Исполнитель отвечает за сохранность переданной ему вещи; в случае её повреждения он обязан в трёхдневный срок заменить её однородной вещью аналогичного качества, а при невозможности — возместить двукратную цену повреждённой вещи, а также понесённые потребителем расходы (п. 1 ст. 35 Закона).`, indent: true });
        P.push({ text: "ТРЕБУЮ:", indent: true, keepNext: true });
        P.push({ text: `в течение трёх дней со дня получения претензии устранить повреждения, заменив повреждённые детали однородными аналогичного качества, а при невозможности — возместить двукратную стоимость устранения повреждений в размере ${F(U.money(typeof a.damage_cost === "number" ? a.damage_cost * 2 : null), "двукратная сумма")} руб. ${refund} (п. 1 ст. 35 Закона).`, indent: true });
        P.push({ text: C.courtThreat("none"), indent: true });
      }
      if (a.situation === "extra") {
        P.push({ text: `Помимо согласованных работ вы выполнили работы, которые я не заказывал(а) и на выполнение которых не давал(а) согласия: ${F(a.extra_desc, "какие работы")}, на сумму ${F(U.money(a.extra_sum), "сумма")} руб. Условия о выполнении дополнительных работ за плату без согласия потребителя недопустимы (пп. 6 п. 2 ст. 16 Закона).`, indent: true });
        P.push({ text: "ТРЕБУЮ:", indent: true, keepNext: true });
        P.push({ text: a.extra_paid === "yes" ? `вернуть уплаченные за эти работы ${F(U.money(a.extra_sum), "сумма")} руб. ${refund} в течение трёх дней со дня предъявления настоящего требования (ст. 16 Закона).` : "исключить стоимость этих работ из счёта. Оплачивать их я не буду.", indent: true });
        P.push({ text: C.courtThreat("none"), indent: true });
      }

      const att = ["Копия заказ-наряда (договора).", "Копия документа об оплате."];
      if (a.situation === "damage") att.push("Фотографии повреждений.", "Смета на устранение повреждений.");
      if (a.situation === "quality" && a.demand === "costs") att.push("Документы о расходах на исправление в другом сервисе.");
      C.attachments(P, att);
      C.sign(P, a);
      return P;
    },

    guidance(a, d) {
      const g = [C.guideSend];
      if (a.situation === "damage" && a.damage_in_act === "no") g.push({ title: "Повреждения не записаны в акте — будет сложнее.", text: "Соберите всё, что показывает состояние машины до сервиса: фото, запись видеорегистратора, отчёт осмотра. Сервис будет говорить, что повреждения появились позже." });
      if (a.situation === "quality") g.push({ title: "Если сервис спорит о причинах — нужна экспертиза.", text: "Не ремонтируйте машину в другом месте до осмотра, иначе доказать плохую работу будет трудно." });
      g.push({ title: "Забирая машину, осматривайте её при сотруднике.", text: "Всё, что не так, пишите в акте приёмки. Попросите вернуть заменённые детали." });
      g.push(C.guideCourt);
      return g;
    },

    fileName(a) { return "Претензия автосервису" + (a.buyer_name ? " — " + U.shortName(a.buyer_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d10 = spec;
})(typeof window !== "undefined" ? window : globalThis);
