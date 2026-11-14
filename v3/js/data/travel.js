/* Sample 1 — travel insurance. Trap type: time thresholds. */
(() => {
  const L = (zh, en) => ({ zh, en });
  window.PL.POLICIES.travel = {
    id: 'travel',
    theme: { accent: '#E4572E', soft: '#FCE4D9', ink: '#B23A16' },
    glyph: '✈',
    kind: L('旅遊保險', 'Travel insurance'),
    name: L('晴程旅遊保', 'SkyWay Travel Cover'),
    trip: L('日本七日滑雪行', '7-day ski trip to Japan'),
    hook: L('「航班延誤最高賠 HK$1,000」', '"Flight delay: up to HK$1,000"'),

    context: [
      { id: 'dest', q: L('去哪裏？', 'Where to?'), options: [
        { id: 'jp', label: L('日本', 'Japan') },
        { id: 'eu', label: L('歐洲', 'Europe') },
        { id: 'sea', label: L('東南亞', 'Southeast Asia') },
      ] },
      { id: 'flight', q: L('怎樣飛？', 'How are you flying?'), options: [
        { id: 'direct', label: L('直航', 'Direct') },
        { id: 'connect', label: L('要轉機', 'With a connection'), tags: ['connecting'] },
      ] },
      { id: 'act', q: L('會做甚麼？', 'What will you do?'), multi: true, options: [
        { id: 'ski', label: L('滑雪', 'Skiing'), tags: ['ski'] },
        { id: 'dive', label: L('潛水', 'Diving') },
        { id: 'city', label: L('城市觀光', 'Sightseeing') },
      ] },
    ],

    document: {
      title: L('晴程旅遊保 · 保單條款', 'SkyWay Travel Cover · Policy wording'),
      sections: [
        { id: 'sch', no: '', page: 1, heading: L('保障表', 'Schedule of benefits'), table: true, lines: [
          { id: 't1', text: L('醫療費用 …… 最高 HK$500,000', 'Medical expenses …… up to HK$500,000') },
          { id: 't2', text: L('行程取消 …… 最高 HK$20,000', 'Trip cancellation …… up to HK$20,000') },
          { id: 't3', text: L('航班延誤 …… 最高 HK$1,000', 'Flight delay …… up to HK$1,000') },
          { id: 't4', text: L('行李及個人物品 …… 最高 HK$8,000', 'Baggage & personal effects …… up to HK$8,000') },
        ] },
        { id: 's2', no: '2', page: 3, heading: L('醫療及意外', 'Medical & accident'), lines: [
          { id: 'm1', text: L('受保人於旅程中因意外或疾病所需之合理醫療費用，本公司按實際支出賠償。', 'We pay reasonable medical expenses incurred during the trip due to accident or illness.') },
          { id: 'm2', text: L('參與職業運動，或於滑雪場指定雪道範圍以外滑雪（off-piste）所引致之損失，不受保障。', 'Losses from professional sports, or from skiing outside marked pistes (off-piste), are not covered.') },
        ] },
        { id: 's3', no: '3', page: 5, heading: L('行程取消', 'Trip cancellation'), lines: [
          { id: 'c1', text: L('如因受保人或直系親屬嚴重受傷、患病或身故而須取消行程，本公司賠償已繳付且不可退回之費用。', 'If the trip is cancelled because you or a close relative is seriously injured, ill or dies, we repay non-refundable costs already paid.') },
          { id: 'c2', text: L('出發前已知悉或可預見之事件，不受保障。', 'Events known or foreseeable before departure are not covered.') },
        ] },
        { id: 's4', no: '4', page: 6, heading: L('航班延誤', 'Flight delay'), lines: [
          { id: 'd1', text: L('受保人預定乘搭之航班如因惡劣天氣、機件故障或工業行動而延誤，每連續延誤超過 6 小時，本公司賠償 HK$200，最高 HK$1,000。', 'If your scheduled flight is delayed by bad weather, mechanical fault or industrial action, we pay HK$200 for each period of delay exceeding 6 consecutive hours, up to HK$1,000.') },
          { id: 'd2', text: L('延誤時間由航班原定起飛時間起計算。', 'Delay is counted from the scheduled departure time.') },
          { id: 'd3', text: L('索償時須提供航空公司發出之書面延誤證明。', 'Claims require written confirmation of the delay issued by the airline.') },
        ] },
        { id: 's5', no: '5', page: 7, heading: L('行李', 'Baggage'), lines: [
          { id: 'b1', text: L('每件或每對物品之賠償上限為 HK$3,000。', 'The limit for any single item or pair is HK$3,000.') },
          { id: 'b2', text: L('行李遺失或被盜，須於 24 小時內向警方或承運人報告，並取得書面報告。', 'Loss or theft must be reported to police or the carrier within 24 hours, with a written report.') },
        ] },
      ],
    },

    analysis: {
      summary: [
        { key: 'covers', ref: 'm1', answer: L('醫療、行程取消、航班延誤、行李', 'Medical, cancellation, flight delay, baggage') },
        { key: 'excludes', ref: 'm2', answer: L('雪道外滑雪、職業運動、出發前已知的事', 'Off-piste skiing, pro sports, anything known before you left') },
        { key: 'max', ref: 't1', answer: L('醫療 HK$500,000；延誤最多 HK$1,000', 'Medical HK$500,000; delay HK$1,000 max') },
        { key: 'when', ref: 'd1', answer: L('延誤要超過 6 小時才開始賠', 'Delay pays only after 6+ hours') },
        { key: 'docs', ref: 'd3', answer: L('航空公司書面證明、24 小時內的報失報告', "Airline's written proof; a loss report within 24 h") },
        { key: 'unclear', ref: 'd2', answer: L('延誤後再取消，按哪一節處理？', 'Delayed, then cancelled — which section applies?') },
      ],
      gap: {
        tableRef: 't3',
        detailRef: 'd1',
        says: L('最高 HK$1,000', 'Up to HK$1,000'),
        reality: L('每超過 6 小時才賠 HK$200。常見的延誤 8 小時，只拿到 HK$200；要延誤超過 30 小時，才有 HK$1,000。', 'HK$200 per 6+ hours. A typical 8-hour delay pays HK$200; you only reach HK$1,000 after 30 hours.'),
        visual: {
          kind: 'split', total: 1000,
          totalLabel: L('保障表寫', 'Schedule says'),
          segments: [{ value: 200, tone: 'paid', label: L('延誤 8 小時', '8-hour delay') }],
          restLabel: L('要延誤 30 小時以上', 'Needs a 30h+ delay'),
        },
      },
      scenarios: [
        {
          id: 'tr-delay', status: 'excluded', ref: 'd1', tags: [],
          title: L('航班延誤 5 小時 50 分', 'Flight delayed 5 h 50 min'),
          why: L('差 10 分鐘未過門檻，一分錢都沒有。剛好 6 小時也未必算「超過」。', 'Ten minutes short means nothing. Exactly 6 hours may not count as "exceeding".'),
          question: L('若航班剛好延誤 6 小時，是否符合「超過 6 小時」？延誤的終點以實際起飛還是登機時間計？', 'If the delay is exactly 6 hours, does it meet "exceeding 6 hours"? Does the delay end at actual take-off or boarding?'),
          visual: {
            kind: 'threshold', format: 'hm', min: 0, max: 36, step: 1 / 6, limit: 6, value: 35 / 6, okSide: 'above',
            unit: L('延誤時數', 'Delay'),
            rate: { every: 6, amount: 200, cap: 1000 },
            outcomes: {
              below: { status: 'excluded', text: L('未過門檻', 'Below threshold') },
              at: { status: 'ask', text: L('剛好 6 小時，算「超過」嗎？', 'Exactly 6 h — is that "exceeding"?') },
              above: { status: 'covered', text: L('過了門檻', 'Threshold met') },
            },
          },
        },
        {
          id: 'tr-cancel', status: 'silent', ref: 'd1', tags: [],
          title: L('先延誤 8 小時，之後航班取消', 'Delayed 8 hours, then cancelled'),
          why: L('第 4 節只講延誤，沒說延誤後取消應按延誤還是取消計。', 'Section 4 covers delays only; it never says what happens if a delay turns into a cancellation.'),
          question: L('航班先延誤後取消，按航班延誤（第 4 節）還是行程取消（第 3 節）處理？兩者能否同時索償？', 'If a delayed flight is then cancelled, is it handled under Section 4 (delay) or Section 3 (cancellation)? Can I claim both?'),
          visual: {
            kind: 'branch', prompt: L('之後發生了甚麼？', 'What happened next?'),
            options: [
              { label: L('延誤後照飛', 'Flew after the delay'), status: 'covered', note: L('按延誤時數計：HK$200', 'Paid by hours: HK$200') },
              { label: L('延誤後被取消', 'Cancelled after the delay'), status: 'silent', note: L('細則沒寫這種情況', 'The wording is silent on this') },
            ],
          },
        },
        {
          id: 'tr-proof', status: 'ask', ref: 'd3', tags: [],
          title: L('航空公司只發了 App 通知', 'The airline only sent an app notice'),
          why: L('條款要求「書面延誤證明」，沒說截圖或電郵是否接受。', 'The wording asks for "written confirmation" but says nothing about screenshots or email.'),
          question: L('航空公司 App 的延誤通知截圖或電郵，可否作為「書面延誤證明」？', 'Does a screenshot of the airline app notice, or an email, count as "written confirmation"?'),
          visual: {
            kind: 'branch', prompt: L('你手上有甚麼證明？', 'What proof do you have?'),
            options: [
              { label: L('櫃位發的延誤信', 'Delay letter from the desk'), status: 'covered', note: L('符合「書面證明」', 'Matches "written confirmation"') },
              { label: L('App 通知截圖', 'App notice screenshot'), status: 'ask', note: L('算不算「書面」，要問', 'Whether it counts as "written" — ask') },
            ],
          },
        },
        {
          id: 'tr-ski', status: 'ask', ref: 'm2', tags: ['ski'],
          title: L('滑雪時受傷', 'Injured while skiing'),
          why: L('雪道外滑雪寫明不保；上滑雪課、坐纜車途中受傷則沒提。', 'Off-piste is excluded; lessons or chairlift injuries are not mentioned.'),
          question: L('在雪場指定雪道內滑雪、上滑雪課或乘搭纜車時受傷，是否受保？是否需要另加冬季運動保障？', 'Am I covered for injuries on marked pistes, during ski lessons, or on chairlifts? Do I need a winter sports add-on?'),
          visual: {
            kind: 'branch', prompt: L('在哪裏受傷？', 'Where were you hurt?'),
            options: [
              { label: L('指定雪道內', 'On a marked piste'), status: 'covered', note: L('不在除外範圍', 'Not excluded') },
              { label: L('雪道以外', 'Off-piste'), status: 'excluded', note: L('第 2 節寫明不保', 'Excluded under Section 2') },
              { label: L('滑雪課上', 'During a lesson'), status: 'silent', note: L('條款沒提課程', 'Lessons not mentioned') },
            ],
          },
        },
        {
          id: 'tr-connect', status: 'silent', ref: 'd2', tags: ['connecting'],
          title: L('第一程延誤，趕不上轉機', 'First leg late, connection missed'),
          why: L('條款只講「預定航班」，沒說聯程的延誤由哪一程開始計。', 'The wording says "scheduled flight" and never explains how delay is counted across connections.'),
          question: L('聯程機票第一程延誤導致錯過第二程，延誤時間由哪一程的原定起飛時間開始計算？', 'If a late first leg makes me miss my connection, from which scheduled departure is the delay counted?'),
          visual: null,
        },
        {
          id: 'tr-camera', status: 'partial', ref: 'b1', tags: [],
          title: L('HK$8,000 的相機在酒店被偷', 'HK$8,000 camera stolen at the hotel'),
          why: L('保障表的 HK$8,000 是行李總額，每件物品最多只賠 HK$3,000。', 'HK$8,000 is the baggage total; any single item pays HK$3,000 at most.'),
          question: L('單件物品上限 HK$3,000 是否包括相機連鏡頭等配件？能否加保高價物品？', 'Does the HK$3,000 single-item limit treat a camera and its lenses as one item? Can I insure high-value items separately?'),
          visual: {
            kind: 'split', total: 8000,
            totalLabel: L('相機價值', 'Camera value'),
            segments: [{ value: 3000, tone: 'paid', label: L('單件上限', 'Item limit') }],
            restLabel: L('自己承擔', 'You pay'),
          },
        },
      ],
    },
  };
})();
