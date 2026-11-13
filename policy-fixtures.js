/* Explicitly fictional frontend examples. No insurer or real product affiliation. */
(function (global) {
  'use strict';
  const items = [
    {
      id: 'fictional-travel-01', title: '週末旅遊', kind: '旅遊保險',
      summary: '虛構旅遊保單，涵蓋取消行程、行李及活動限制的閱讀示例。',
      sourceLabel: '虛構條款 · 旅遊示例 · 第 2–5 節', demo: true,
      excerpt: '只有在預訂日期後發生條款列明的事件，取消行程保障才適用。行李索償須提供物品擁有權證明，並在 24 小時內報告。除非保單附表列明已加保相關活動，否則冬季運動不在保障範圍內。每宗獲接納的行李索償均須扣除 150 個示例金額單位的墊底費。',
      findings: [
        { id: 'travel-cancellation', priority: 1, title: '確認取消行程的觸發條件', question: '哪些列明事件可以讓我取消這次行程並申請索償？', quote: '只有在預訂日期後發生條款列明的事件，取消行程保障才適用。' },
        { id: 'travel-baggage', priority: 2, title: '保留所需證明', question: '行李遺失時，我需要哪些證明，並應向誰報告？', quote: '行李索償須提供物品擁有權證明，並在 24 小時內報告。' },
        { id: 'travel-activities', priority: 3, title: '確認計劃參與的活動', question: '我的保單附表有否列明冬季運動的附加保障？', quote: '除非保單附表列明已加保相關活動，否則冬季運動不在保障範圍內。' },
        { id: 'travel-excess', priority: 4, title: '留意墊底費', question: '150 個示例金額單位的墊底費，會如何影響小額行李索償？', quote: '每宗獲接納的行李索償均須扣除 150 個示例金額單位的墊底費。' }
      ]
    },
    {
      id: 'fictional-home-02', title: '日常家居', kind: '家居財物保險',
      summary: '虛構家居財物保單，說明住所空置、貴重物品及單據的閱讀重點。',
      sourceLabel: '虛構條款 · 家居示例 · 第 3–6 節', demo: true,
      excerpt: '住所連續空置 30 天後，盜竊保障將會暫停。每件價值超過 2,000 個示例金額單位的貴重物品，均須在保單附表內逐項列明。只有選擇相關附加保障，意外損毀才納入保障範圍。索償將按價值證明及本條款的重置規定評估。',
      findings: [
        { id: 'home-unoccupied', priority: 1, title: '留意離家日數', question: '住所空置超過 30 天之前，我應先作哪些安排？', quote: '住所連續空置 30 天後，盜竊保障將會暫停。' },
        { id: 'home-valuables', priority: 2, title: '逐項申報高價物品', question: '我有哪些物品需要在保單附表內逐項列明？', quote: '每件價值超過 2,000 個示例金額單位的貴重物品，均須在保單附表內逐項列明。' },
        { id: 'home-extension', priority: 3, title: '確認附加保障', question: '我的保單附表有否列明已選擇意外損毀保障？', quote: '只有選擇相關附加保障，意外損毀才納入保障範圍。' },
        { id: 'home-value', priority: 4, title: '保留價值紀錄', question: '我應保留哪些單據或其他價值證明？', quote: '索償將按價值證明及本條款的重置規定評估。' }
      ]
    },
    {
      id: 'fictional-health-03', title: '健康筆記', kind: '醫療保險',
      summary: '虛構醫療保單，說明等候期、健康披露及預先批核的閱讀重點。',
      sourceLabel: '虛構條款 · 醫療示例 · 第 1–4 節', demo: true,
      excerpt: '除非列明例外情況，否則保單生效首 60 天內的計劃治療不在本示例保障範圍內。保單生效前必須披露已有症狀及病況。除緊急情況外，住院治療須事先獲得批核。專科診症必須提供轉介信。',
      findings: [
        { id: 'health-waiting', priority: 1, title: '留意等候期', question: '我計劃接受的治療，會否落在保單生效後首 60 天內？', quote: '除非列明例外情況，否則保單生效首 60 天內的計劃治療不在本示例保障範圍內。' },
        { id: 'health-disclosure', priority: 2, title: '釐清須披露的資料', question: '我有哪些已有症狀及病況需要披露？', quote: '保單生效前必須披露已有症狀及病況。' },
        { id: 'health-authorisation', priority: 3, title: '確認預先批核程序', question: '住院治療前，我應如何申請預先批核？', quote: '除緊急情況外，住院治療須事先獲得批核。' },
        { id: 'health-referral', priority: 4, title: '保留轉介信', question: '專科診症所需的轉介信，應由誰發出？', quote: '專科診症必須提供轉介信。' }
      ]
    }
  ];
  items.forEach(item => { item.findings.forEach(Object.freeze); Object.freeze(item.findings); Object.freeze(item); });
  global.PolicyFixtures = Object.freeze({ items: Object.freeze(items) });
})(window);
