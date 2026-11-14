/* Sample 2 — critical illness. Trap type: definitions & waiting periods. */
(() => {
  const L = (zh, en) => ({ zh, en });
  window.PL.POLICIES.critical = {
    id: 'critical',
    theme: { accent: '#6A4BD0', soft: '#ECE6FB', ink: '#4B2FA8' },
    glyph: '♥',
    kind: L('危疾保險', 'Critical illness'),
    name: L('安心危疾保', 'SteadyCare Critical Illness'),
    trip: L('保額 HK$1,000,000', 'Sum insured HK$1,000,000'),
    hook: L('「確診癌症賠 HK$1,000,000」', '"Cancer pays HK$1,000,000"'),

    context: [
      { id: 'age', q: L('你的年齡？', 'Your age?'), options: [
        { id: 'u30', label: L('30 歲以下', 'Under 30') },
        { id: 'mid', label: L('30–50 歲', '30–50') },
        { id: 'o50', label: L('50 歲以上', 'Over 50') },
      ] },
      { id: 'check', q: L('最近一年做過體檢嗎？', 'Health check in the last year?'), options: [
        { id: 'follow', label: L('有，有項目要跟進', 'Yes, something to follow up'), tags: ['checkup'] },
        { id: 'ok', label: L('有，一切正常', 'Yes, all clear') },
        { id: 'none', label: L('沒有', 'No') },
      ] },
      { id: 'abroad', q: L('常在海外生活或工作？', 'Often live or work abroad?'), options: [
        { id: 'yes', label: L('是', 'Yes'), tags: ['abroad'] },
        { id: 'no', label: L('否', 'No') },
      ] },
    ],

    document: {
      title: L('安心危疾保 · 保單條款', 'SteadyCare Critical Illness · Policy wording'),
      sections: [
        { id: 'sch', no: '', page: 1, heading: L('保障表', 'Schedule of benefits'), table: true, lines: [
          { id: 'k1', text: L('嚴重疾病（包括癌症）…… 保額 100%（HK$1,000,000）', 'Major illness (incl. cancer) …… 100% of sum insured (HK$1,000,000)') },
          { id: 'k2', text: L('早期疾病 …… 保額 20%，以一次為限', 'Early-stage illness …… 20% of sum insured, once only') },
        ] },
        { id: 's2', no: '2', page: 3, heading: L('等候期', 'Waiting period'), lines: [
          { id: 'w1', text: L('保單生效日起 90 日內出現徵狀或確診之疾病，不獲賠償。', 'Illnesses with symptoms or a diagnosis within 90 days of the policy start date are not payable.') },
        ] },
        { id: 's3', no: '3', page: 4, heading: L('定義', 'Definitions'), lines: [
          { id: 'f1', text: L('「癌症」指經組織病理學證實之惡性腫瘤，不包括原位癌。', '"Cancer" means a malignant tumour confirmed by histopathology, excluding carcinoma in situ.') },
          { id: 'f2', text: L('原位癌屬早期疾病，按保額 20% 賠償。', 'Carcinoma in situ is an early-stage illness, paid at 20% of the sum insured.') },
        ] },
        { id: 's5', no: '5', page: 6, heading: L('投保前已有狀況', 'Pre-existing conditions'), lines: [
          { id: 'p1', text: L('投保前已存在之疾病或徵狀，不論是否已確診，均不受保障。', 'Illnesses or symptoms existing before the policy starts are not covered, whether or not diagnosed.') },
        ] },
        { id: 's6', no: '6', page: 8, heading: L('索償', 'Claims'), lines: [
          { id: 'n1', text: L('確診須由註冊專科醫生以病理報告證實。', 'Diagnosis must be confirmed by a registered specialist with a pathology report.') },
          { id: 'n2', text: L('受保人須於確診後 90 日內以書面通知本公司。', 'You must notify us in writing within 90 days of diagnosis.') },
        ] },
      ],
    },

    analysis: {
      summary: [
        { key: 'covers', ref: 'k1', answer: L('確診嚴重疾病，一次過賠保額', 'A major illness pays the sum insured in one go') },
        { key: 'excludes', ref: 'p1', answer: L('首 90 日內的病、投保前已有的徵狀', 'Anything in the first 90 days, or symptoms you already had') },
        { key: 'max', ref: 'k2', answer: L('嚴重疾病 HK$1,000,000；早期疾病 HK$200,000', 'Major HK$1,000,000; early-stage HK$200,000') },
        { key: 'when', ref: 'w1', answer: L('生效 90 日後確診，而且符合條款定義', 'Diagnosed after day 90 and matching the definition') },
        { key: 'docs', ref: 'n1', answer: L('專科醫生病理報告；確診後 90 日內書面通知', 'Specialist pathology report; written notice within 90 days') },
        { key: 'unclear', ref: 'p1', answer: L('「徵狀」由誰認定？體檢寫「需跟進」算嗎？', 'Who decides what a "symptom" is? Does "follow up" on a check-up count?') },
      ],
      gap: {
        tableRef: 'k1',
        detailRef: 'f1',
        says: L('癌症 HK$1,000,000', 'Cancer HK$1,000,000'),
        reality: L('「癌症」不包括原位癌。最常見的早期癌症，只賠 20%。', '"Cancer" excludes carcinoma in situ. The most common early cancers pay only 20%.'),
        visual: {
          kind: 'split', total: 1000000,
          totalLabel: L('保障表寫', 'Schedule says'),
          segments: [{ value: 200000, tone: 'paid', label: L('原位癌 20%', 'In situ 20%') }],
          restLabel: L('原位癌不賠這部分', 'Not paid for in situ'),
        },
      },
      scenarios: [
        {
          id: 'ci-day89', status: 'excluded', ref: 'w1', tags: [],
          title: L('生效後第 89 日確診', 'Diagnosed on day 89'),
          why: L('早一天確診，就落在等候期內。第 90 日當天算不算，條款沒說清。', 'One day early falls inside the waiting period. Whether day 90 itself counts is unclear.'),
          question: L('等候期「90 日內」是否包括第 90 日當天？以確診日、驗血日還是病理報告日為準？', 'Does "within 90 days" include day 90 itself? Is it the date of diagnosis, the blood test, or the pathology report?'),
          visual: {
            kind: 'threshold', format: 'day', min: 0, max: 180, step: 1, limit: 90, value: 89, okSide: 'above',
            unit: L('確診日', 'Diagnosis day'),
            outcomes: {
              below: { status: 'excluded', text: L('在等候期內', 'Inside waiting period') },
              at: { status: 'ask', text: L('第 90 日當天算嗎？', 'Does day 90 count?') },
              above: { status: 'covered', text: L('已過等候期', 'Waiting period over') },
            },
          },
        },
        {
          id: 'ci-symptom', status: 'excluded', ref: 'w1', tags: [],
          title: L('第 60 日開始咳嗽，第 120 日才確診', 'Cough from day 60, diagnosed on day 120'),
          why: L('確診在等候期後，但徵狀出現在等候期內，條款寫明不賠。', 'The diagnosis is after the waiting period, but the symptom started inside it — excluded.'),
          question: L('若徵狀在等候期內出現、確診在等候期後，是否不獲賠償？「徵狀」由誰判定？', 'If symptoms start inside the waiting period but diagnosis comes after, is the claim refused? Who decides what counts as a symptom?'),
          visual: null,
        },
        {
          id: 'ci-checkup', status: 'ask', ref: 'p1', tags: ['checkup'],
          title: L('投保前體檢寫了「需跟進」', 'Check-up said "follow up" before you bought it'),
          why: L('「不論是否已確診」範圍很闊，一個未確診的異常也可能被當成已有徵狀。', '"Whether or not diagnosed" is broad — an unconfirmed finding could count as a prior symptom.'),
          question: L('投保前體檢報告有「需跟進」項目但未確診，是否屬於「已存在之徵狀」？投保時應否申報？', 'If a pre-policy check-up flagged something to follow up but nothing was diagnosed, is that a "pre-existing symptom"? Should I declare it?'),
          visual: {
            kind: 'branch', prompt: L('投保前的情況？', 'Before you bought it?'),
            options: [
              { label: L('已經確診', 'Already diagnosed'), status: 'excluded', note: L('寫明不保', 'Clearly excluded') },
              { label: L('報告寫「需跟進」', 'Report said "follow up"'), status: 'ask', note: L('算不算徵狀，要問', 'Is that a symptom? Ask') },
              { label: L('完全正常', 'All clear'), status: 'covered', note: L('不受此條影響', 'Not affected') },
            ],
          },
        },
        {
          id: 'ci-insitu', status: 'partial', ref: 'f2', tags: [],
          title: L('確診乳房原位癌', 'Diagnosed with breast carcinoma in situ'),
          why: L('原位癌按早期疾病賠 20%，而且只賠一次。', 'In situ is paid as early-stage: 20%, once only.'),
          question: L('原位癌賠 20% 後，保額是否扣減？之後若發展成惡性腫瘤，能否再賠餘下的 80%？', 'After a 20% in situ payout, is the sum insured reduced? If it later becomes malignant, is the remaining 80% payable?'),
          visual: {
            kind: 'branch', prompt: L('病理報告寫甚麼？', 'What does the pathology say?'),
            options: [
              { label: L('原位癌', 'In situ'), status: 'partial', note: L('賠 HK$200,000', 'Pays HK$200,000') },
              { label: L('惡性腫瘤', 'Malignant'), status: 'covered', note: L('賠 HK$1,000,000', 'Pays HK$1,000,000') },
            ],
          },
        },
        {
          id: 'ci-notice', status: 'ask', ref: 'n2', tags: [],
          title: L('確診後忙於治療，第 100 日才通知', 'Busy with treatment, notified on day 100'),
          why: L('條款要求 90 日內通知，但沒說逾期會不會拒賠。', 'The wording requires notice within 90 days but never says late notice voids the claim.'),
          question: L('確診後超過 90 日才通知，是否會被拒賠？若因住院未能通知，有沒有寬限？', 'Will a claim be refused if notice comes after 90 days? Is there leeway if I was in hospital?'),
          visual: {
            kind: 'threshold', format: 'day', min: 0, max: 180, step: 1, limit: 90, value: 100, okSide: 'below',
            unit: L('確診後第幾日通知', 'Days after diagnosis'),
            outcomes: {
              below: { status: 'covered', text: L('在期限內', 'Within the deadline') },
              at: { status: 'ask', text: L('剛好第 90 日', 'Exactly day 90') },
              above: { status: 'silent', text: L('逾期後果沒寫', 'Consequence not stated') },
            },
          },
        },
        {
          id: 'ci-abroad', status: 'silent', ref: 'n1', tags: ['abroad'],
          title: L('在海外確診，報告由當地醫生簽發', 'Diagnosed abroad by a local doctor'),
          why: L('條款要求「註冊專科醫生」，沒說是否包括海外註冊。', 'The wording requires a "registered specialist" without saying where they must be registered.'),
          question: L('「註冊專科醫生」是否包括海外註冊的醫生？外文病理報告是否需要翻譯或認證？', 'Does "registered specialist" include doctors registered overseas? Do foreign-language reports need translation or certification?'),
          visual: null,
        },
      ],
    },
  };
})();
