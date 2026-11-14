/* Sample 3 — home contents. Trap type: cause of loss & per-item limits. */
(() => {
  const L = (zh, en) => ({ zh, en });
  window.PL.POLICIES.home = {
    id: 'home',
    theme: { accent: '#18806F', soft: '#DCF0EB', ink: '#0F5F52' },
    glyph: '⌂',
    kind: L('家居財物保險', 'Home contents'),
    name: L('安居家財保', 'HomeShield Contents'),
    trip: L('自住單位 · 600 呎', 'Own flat · 600 sq ft'),
    hook: L('「家居財物保障 HK$300,000」', '"Contents cover HK$300,000"'),

    context: [
      { id: 'own', q: L('住所是？', 'Your home is?'), options: [
        { id: 'own', label: L('自置', 'Owned') },
        { id: 'rent', label: L('租住', 'Rented') },
      ] },
      { id: 'away', q: L('會長時間不在家嗎？', 'Away for long stretches?'), options: [
        { id: 'yes', label: L('會，一次一個月以上', 'Yes, a month or more'), tags: ['away'] },
        { id: 'no', label: L('不會', 'No') },
      ] },
      { id: 'items', q: L('家中有高價物品？', 'Valuables at home?'), multi: true, options: [
        { id: 'bike', label: L('單車', 'Bicycle'), tags: ['valuables'] },
        { id: 'audio', label: L('音響', 'Hi-fi'), tags: ['valuables'] },
        { id: 'laptop', label: L('公司電腦', 'Work laptop'), tags: ['wfh'] },
      ] },
    ],

    document: {
      title: L('安居家財保 · 保單條款', 'HomeShield Contents · Policy wording'),
      sections: [
        { id: 'sch', no: '', page: 1, heading: L('保障表', 'Schedule of benefits'), table: true, lines: [
          { id: 'h1', text: L('家居財物 …… 最高 HK$300,000', 'Household contents …… up to HK$300,000') },
          { id: 'h2', text: L('單件物品 …… 每件 HK$5,000', 'Any single item …… HK$5,000 each') },
          { id: 'h3', text: L('每宗索償墊底費 …… HK$500', 'Excess per claim …… HK$500') },
        ] },
        { id: 's2', no: '2', page: 3, heading: L('水漬', 'Water damage'), lines: [
          { id: 'wt1', text: L('因水管或水缸突然爆裂而引致之損失，受保障。', 'Loss caused by the sudden bursting of a pipe or tank is covered.') },
          { id: 'wt2', text: L('逐漸滲漏、滲水或因欠缺保養引致之損失，不受保障。', 'Loss from gradual leaks, seepage or lack of maintenance is not covered.') },
        ] },
        { id: 's3', no: '3', page: 4, heading: L('盜竊', 'Theft'), lines: [
          { id: 'th1', text: L('盜竊須涉及以暴力強行進出住所，並留有痕跡。', 'Theft must involve forcible and violent entry to or exit from the home, leaving visible marks.') },
          { id: 'th2', text: L('受保人須於發現後 24 小時內報警。', 'You must report to the police within 24 hours of discovery.') },
        ] },
        { id: 's4', no: '4', page: 5, heading: L('物品限額', 'Item limits'), lines: [
          { id: 'it1', text: L('任何單一物品或一套物品之賠償以 HK$5,000 為限，除非已於附表另行列明。', 'Any single item or set is limited to HK$5,000 unless separately listed in the schedule.') },
        ] },
        { id: 's5', no: '5', page: 6, heading: L('空置', 'Unoccupancy'), lines: [
          { id: 'v1', text: L('住所連續無人居住超過 30 日，盜竊及水漬保障暫停。', 'If the home is unoccupied for more than 30 consecutive days, theft and water cover is suspended.') },
        ] },
      ],
    },

    analysis: {
      summary: [
        { key: 'covers', ref: 'wt1', answer: L('水管爆裂、爆竊等突發損失', 'Sudden losses like burst pipes and break-ins') },
        { key: 'excludes', ref: 'wt2', answer: L('慢慢滲漏、沒有撬痕的盜竊', 'Slow leaks; theft with no forced entry') },
        { key: 'max', ref: 'h2', answer: L('總額 HK$300,000；每件只賠 HK$5,000', 'HK$300,000 total; HK$5,000 per item') },
        { key: 'when', ref: 'v1', answer: L('突發事故，而且屋子空置不超過 30 日', 'Sudden events, with the home empty no more than 30 days') },
        { key: 'docs', ref: 'th2', answer: L('24 小時內的報案記錄、物品價值證明', 'Police report within 24 h; proof of value') },
        { key: 'unclear', ref: 'wt1', answer: L('樓上單位滲水落你家，算哪一種？', "Water from the flat upstairs — which rule applies?") },
      ],
      gap: {
        tableRef: 'h1',
        detailRef: 'it1',
        says: L('家居財物 HK$300,000', 'Contents HK$300,000'),
        reality: L('每件物品上限 HK$5,000。HK$30,000 的單車被偷，扣墊底費後只賠 HK$4,500。', 'Each item is capped at HK$5,000. A stolen HK$30,000 bike pays HK$4,500 after the excess.'),
        visual: {
          kind: 'split', total: 30000,
          totalLabel: L('單車價值', 'Bike value'),
          segments: [
            { value: 4500, tone: 'paid', label: L('賠付', 'Paid') },
            { value: 500, tone: 'deduct', label: L('墊底費', 'Excess') },
          ],
          restLabel: L('自己承擔', 'You pay'),
        },
      },
      scenarios: [
        {
          id: 'hm-water', status: 'ask', ref: 'wt2', tags: [],
          title: L('浴室天花滲水，木地板發脹', 'Bathroom ceiling leaks, floor swells'),
          why: L('「突然爆裂」有保，「逐漸滲漏」不保。同一灘水，原因不同結果相反。', '"Sudden burst" is covered, "gradual leak" is not. Same water, opposite result.'),
          question: L('若滲水源自樓上單位，或無法判斷是突然爆裂還是逐漸滲漏，如何判定？需要甚麼證明？', 'If water comes from the flat above, or nobody can tell burst from seepage, how is it decided? What proof is needed?'),
          visual: {
            kind: 'branch', prompt: L('水從哪裏來？', 'Where did the water come from?'),
            options: [
              { label: L('水管突然爆裂', 'A pipe burst'), status: 'covered', note: L('第 2 節有保', 'Covered under Section 2') },
              { label: L('長期慢慢滲', 'Slow seepage'), status: 'excluded', note: L('寫明不保', 'Clearly excluded') },
              { label: L('樓上單位漏落來', 'From the flat above'), status: 'silent', note: L('條款沒提', 'Not mentioned') },
            ],
          },
        },
        {
          id: 'hm-away', status: 'excluded', ref: 'v1', tags: ['away'],
          title: L('去旅行 35 日，回來發現被爆竊', 'Back after 35 days away to find a break-in'),
          why: L('空置超過 30 日，盜竊和水漬保障自動暫停。', 'After 30 days empty, theft and water cover switch off.'),
          question: L('「無人居住」如何計算？家人或朋友每星期上來看一次，是否算有人居住？', 'How is "unoccupied" counted? If someone checks in weekly, does that count as occupied?'),
          visual: {
            kind: 'threshold', format: 'days', min: 0, max: 60, step: 1, limit: 30, value: 35, okSide: 'below',
            unit: L('連續空置', 'Days empty'),
            outcomes: {
              below: { status: 'covered', text: L('保障有效', 'Cover active') },
              at: { status: 'ask', text: L('剛好 30 日', 'Exactly 30 days') },
              above: { status: 'excluded', text: L('盜竊及水漬暫停', 'Theft & water suspended') },
            },
          },
        },
        {
          id: 'hm-noforce', status: 'ask', ref: 'th1', tags: [],
          title: L('家中財物不見了，門鎖完好', 'Things gone, but the lock is intact'),
          why: L('條款要求「暴力強行進出並留有痕跡」。沒有撬痕，很可能不賠。', 'The wording needs "forcible entry with visible marks". No marks, likely no payout.'),
          question: L('若竊賊用偷來的鎖匙開門，或從未上鎖的窗口進入，是否符合「暴力強行進出」？', 'If a thief used a stolen key or an unlocked window, does that meet "forcible entry"?'),
          visual: {
            kind: 'branch', prompt: L('竊賊怎樣進來？', 'How did they get in?'),
            options: [
              { label: L('撬開門鎖', 'Forced the lock'), status: 'covered', note: L('符合條件', 'Meets the condition') },
              { label: L('忘記鎖門', 'Door left unlocked'), status: 'excluded', note: L('沒有強行進出', 'No forcible entry') },
              { label: L('用偷來的鎖匙', 'Used a stolen key'), status: 'silent', note: L('條款沒提', 'Not mentioned') },
            ],
          },
        },
        {
          id: 'hm-set', status: 'partial', ref: 'it1', tags: ['valuables'],
          title: L('一套 HK$12,000 的音響被偷', 'A HK$12,000 hi-fi set stolen'),
          why: L('喇叭加擴音機算「一套」，只當一件計，上限 HK$5,000。', 'Speakers plus amp count as one "set", capped at HK$5,000.'),
          question: L('一套物品是否只按一件計算上限？若預先在附表列明，需要額外保費嗎？', 'Is a set always capped as a single item? Does listing it in the schedule cost extra?'),
          visual: {
            kind: 'split', total: 12000,
            totalLabel: L('音響價值', 'Hi-fi value'),
            segments: [
              { value: 4500, tone: 'paid', label: L('賠付', 'Paid') },
              { value: 500, tone: 'deduct', label: L('墊底費', 'Excess') },
            ],
            restLabel: L('自己承擔', 'You pay'),
          },
        },
        {
          id: 'hm-laptop', status: 'silent', ref: 'it1', tags: ['wfh'],
          title: L('在家工作，公司借的電腦被偷', 'Working from home, company laptop stolen'),
          why: L('條款只講「受保人財物」，沒說借來或屬於僱主的物品。', 'The wording covers "your property" and never mentions borrowed or employer-owned items.'),
          question: L('在家使用的公司財物（例如手提電腦）被盜，是否受本保單保障？', 'Is employer-owned equipment used at home, such as a laptop, covered by this policy?'),
          visual: null,
        },
      ],
    },
  };
})();
