/*
 * Grounded, deterministic replies for the fictional Policy Lens prototype.
 * This is a local demonstration library, not an LLM or document-analysis API.
 * Return values are plain text. The consuming view must escape all text.
 */
(() => {
  'use strict';

  const topics = {
  "basic": {
    "title": "先從保險憑證看起。",
    "sourceIds": [
      "basic"
    ],
    "scenarioIds": [],
    "explain": [
      "示例以保險憑證上的開始時間、結束時間及目的地界定基本範圍，但各項保障仍有自己的條件。",
      "示例並未提供你的實際日期或合資格目的地名單，請核對你準備投保的旅程憑證。"
    ],
    "boundary": [
      "假設某班航機或活動在憑證所列的時間或目的地以外，示例並不能直接回答這個個別情況。",
      "請確認保障期間及目的地如何涵蓋完整行程，包括轉機或延長旅程，並先取得實際憑證。"
    ],
    "followUps": [
      "航班延誤條件怎樣寫？",
      "需要準備哪些文件？",
      "轉機情況應該怎樣問？"
    ],
    "ask": [
      "可以問：「請確認憑證列明的開始及結束時間和目的地，是否符合我的完整行程，包括轉機或延長旅程？」",
      "再確認你關心的保障另有哪些個別條件。"
    ]
  },
  "delay": {
    "title": "上限金額，不等於觸發條件。",
    "sourceIds": [
      "delay"
    ],
    "scenarioIds": [
      "threshold",
      "cancel",
      "connection"
    ],
    "explain": [
      "示例規定航班須連續延誤超過 6 小時，每連續 6 小時支付人民幣 200 元，累計上限人民幣 1,000 元，並須有承運人簽發的延誤證明。",
      "宣傳中的人民幣 1,000 元是累計上限，不代表每次延誤都有這筆賠款；準確門檻、計時方式、取消及錯過轉機的處理仍待確認。"
    ],
    "boundary": [
      "可以分別問三個情況：剛好延誤 6 小時、先延誤後取消，以及首程延誤導致錯過轉機。",
      "示例未交代這些情況的處理，請把它們保留為待確認問題，避免直接當成索償結論。"
    ],
    "followUps": [
      "如果剛好延誤 6 小時呢？",
      "如果航班之後取消呢？",
      "錯過轉機怎樣處理？"
    ],
    "ask": [
      "可以問：「連續延誤的起止時間怎樣界定，人民幣 200 元如何計算，航班取消或錯過轉機又怎樣處理？」",
      "請對方在回答時一併提供適用條款及承運人證明要求。"
    ]
  },
  "threshold": {
    "title": "六小時的邊界，需要準確答案。",
    "sourceIds": [
      "delay"
    ],
    "scenarioIds": [
      "threshold"
    ],
    "explain": [
      "示例使用「超過 6 小時」，但沒有進一步界定準確門檻，或計算採用的開始及結束時間。",
      "若剛好延誤 6 小時，或只相差數分鐘，應確認這些字眼和計時規則如何適用；本示例不判定索償資格。"
    ],
    "boundary": [
      "例如延誤 5 小時 50 分鐘、剛好 6 小時及略超過 6 小時，是條款邊界上不同的事實。",
      "示例未定義準確計算方法，請問清楚哪些原定及實際事件作為延誤的開始和結束。"
    ],
    "followUps": [
      "航班延誤時間怎樣計算？",
      "如果航班之後取消呢？",
      "航空公司通知截圖可以作證明嗎？"
    ],
    "questionId": "threshold"
  },
  "cancel": {
    "title": "航班取消，是未獲解答的邊界情況。",
    "sourceIds": [
      "delay"
    ],
    "scenarioIds": [
      "cancel"
    ],
    "explain": [
      "示例有航班延誤保障，但未直接解釋先延誤、其後取消的情況。",
      "缺少說明並不等於受保或不保。請確認取消由哪項保障處理，以及已產生的延誤時間怎樣計算。"
    ],
    "boundary": [
      "假設航班延誤數小時後取消，計算延誤和處理取消其實是兩個問題。",
      "示例沒有提供這項處理規則，請索取相關條款，避免假設延誤保障會自動適用。"
    ],
    "followUps": [
      "延誤條款實際怎樣寫？",
      "需要甚麼證明？",
      "如果錯過下一班轉機航班呢？"
    ],
    "questionId": "cancel"
  },
  "connection": {
    "title": "轉機情況，需要獨立確認。",
    "sourceIds": [
      "delay"
    ],
    "scenarioIds": [
      "connection"
    ],
    "explain": [
      "示例未直接說明錯過轉機、後續安排，或聯程行程的延誤時間應如何計算。",
      "請分開描述首程延誤和錯過後續航班，再問適用哪條條款、從何時計時及所需證明。"
    ],
    "boundary": [
      "假設首程延誤導致趕不上下一班航機，單一航班延誤與整段行程受阻並非同一回事。",
      "示例未說明處理方法，請帶同行程，並索取適用於實際事件次序的條款。"
    ],
    "followUps": [
      "延誤時間怎樣計算？",
      "通知截圖可否代替證明？",
      "如果首程航班取消呢？"
    ],
    "questionId": "connection"
  },
  "proof": {
    "title": "通知與證明，未能確認可互相代替。",
    "sourceIds": [
      "claim",
      "delay"
    ],
    "scenarioIds": [
      "proof"
    ],
    "explain": [
      "示例要求承運人簽發的延誤證明；文件條款未說明航空公司應用程式通知截圖能否代替證明。",
      "請保留截圖，同時問清楚是否符合要求；若不符合，應怎樣取得承運人證明。"
    ],
    "boundary": [
      "假設你只有航空公司應用程式截圖而沒有獨立證明，截圖雖有紀錄作用，但示例未確認可作替代文件。",
      "請確認接受哪些承運人證明及如何申領，本原型不會替真實申請驗證文件。"
    ],
    "followUps": [
      "還需要哪些文件？",
      "六小時條件是甚麼意思？",
      "行李延誤應保留甚麼？"
    ],
    "questionId": "proof"
  },
  "ski": {
    "title": "具體描述你打算怎樣滑雪。",
    "sourceIds": [
      "sport"
    ],
    "scenarioIds": [
      "ski"
    ],
    "explain": [
      "示例限制高風險、專業及競賽活動，並列出滑雪比賽，但未直接說明一般休閒滑雪或滑雪課程。",
      "請具體描述一般滑雪場活動及初學課程，分別確認是否在保障範圍，以及是否需要附加保障。"
    ],
    "boundary": [
      "一般滑雪場的休閒滑雪、初學課程和滑雪比賽是不同情況。示例限制滑雪比賽，但未定義前兩者。",
      "不要把休閒活動當作已有定論，請確認實際計劃活動適用的定義和條款。"
    ],
    "followUps": [
      "初學滑雪課程應該怎樣問？",
      "活動限制怎樣寫？",
      "缺少哪些醫療機構資料？"
    ],
    "questionId": "ski"
  },
  "diving": {
    "title": "休閒潛水，仍要核對保障範圍。",
    "sourceIds": [
      "sport"
    ],
    "scenarioIds": [
      "diving"
    ],
    "explain": [
      "示例將競賽潛水列為受限制活動，但未直接說明休閒潛水。",
      "請向保險顧問描述實際活動，問清楚適用條件及是否需要附加保障；示例不能證明你的活動已受保。"
    ],
    "boundary": [
      "休閒潛水與競賽活動是不同描述，示例處理了後者的限制，卻未解答休閒潛水。",
      "請索取活動定義、適用條件及回答所依據的條款。"
    ],
    "followUps": [
      "活動限制怎樣寫？",
      "潛水問題怎樣問得更具體？",
      "缺少哪些醫療機構資料？"
    ],
    "questionId": "diving"
  },
  "sport": {
    "title": "活動的具體描述，很重要。",
    "sourceIds": [
      "sport"
    ],
    "scenarioIds": [
      "ski",
      "diving"
    ],
    "explain": [
      "示例把高風險、專業或競賽活動引致的損失排除於基本保障外，並列出滑雪比賽及競賽潛水。",
      "它未直接說明休閒滑雪、滑雪課程或休閒潛水，請按實際活動提問，不要只依賴概括的活動名稱。"
    ],
    "boundary": [
      "示例本身留下了一般滑雪場滑雪、滑雪課程及休閒潛水等未解答情況。",
      "可用這些情況核對相關定義及附加保障要求；它們是假設問題，不是保障結論。"
    ],
    "followUps": [
      "初學滑雪課程呢？",
      "休閒潛水呢？",
      "缺少哪些醫療機構資料？"
    ],
    "ask": [
      "可以問：「我計劃參加這項具體活動，適用哪個活動定義及條款？是否在基本保障範圍，是否需要附加保障？」",
      "示例中的滑雪及潛水情境問題，可協助把提問寫得更具體。"
    ]
  },
  "baggage": {
    "title": "保留證明，以及必需品單據。",
    "sourceIds": [
      "baggage",
      "claim"
    ],
    "scenarioIds": [
      "baggage"
    ],
    "explain": [
      "示例適用於抵達後超過 8 小時才送達的隨行託運行李，按等候期間購買必需品的實際開支申請，累計上限人民幣 1,000 元。",
      "必須有承運人簽發的行李延誤證明及相關單據；上限不是固定賠款承諾，其他保障條件亦適用。"
    ],
    "boundary": [
      "假設託運行李延誤超過 8 小時，你在等候時購買必需品，申請須結合實際開支、時間及證明。",
      "保留承運人證明及單據，再確認其他所需資料；本示例不判定個別購物是否合資格。"
    ],
    "followUps": [
      "還需要哪些文件？",
      "行李保障上限怎樣寫？",
      "航班延誤保障怎樣說？"
    ],
    "questionId": "baggage"
  },
  "medical": {
    "title": "宣傳金額以外，還有重要資料。",
    "sourceIds": [
      "medical"
    ],
    "scenarioIds": [
      "medical"
    ],
    "explain": [
      "示例保障屬意外受傷引致的合資格海外醫療費用，累計上限人民幣 200,000 元，另有指定機構及合資格費用條件。",
      "示例未附機構名單及費用細則，使用宣傳金額作判斷前應先索取；示例不能證明某機構或費用符合要求。"
    ],
    "boundary": [
      "假設你在海外意外受傷，需要尋找醫療機構，單看保障上限並不能找出合資格機構或費用。",
      "由於示例缺少這些資料，請索取指定機構名單及費用細則；這是條款問題，不是醫療建議。"
    ],
    "followUps": [
      "應索取哪些機構及費用資料？",
      "滑雪情況應該怎樣問？",
      "示例列出哪些證明文件？"
    ],
    "questionId": "medical"
  },
  "claim": {
    "title": "所需證明，視乎個別保障。",
    "sourceIds": [
      "claim"
    ],
    "scenarioIds": [
      "proof",
      "baggage"
    ],
    "explain": [
      "示例列出保險憑證、相關行程及各保障要求的文件。航班延誤須有承運人證明，行李延誤還須相關購物單據。",
      "它未確認航空公司應用程式截圖可代替承運人證明，這些文件要求本身亦不代表已符合索償資格。"
    ],
    "boundary": [
      "只有截圖而沒有承運人證明，是一項未解答的文件問題；行李延誤也涉及保留必需品單據。",
      "請按個別保障確認所需證明及取得方式，不要假設一份文件適用於所有申請。"
    ],
    "followUps": [
      "通知截圖可否代替證明？",
      "行李延誤應保留甚麼？",
      "錯過轉機應該怎樣問？"
    ],
    "ask": [
      "可以問：「就這項保障，請確認全部所需文件及取得方式。航空公司通知能否代替承運人證明，還是必須另有文件？」",
      "請把回覆與相關保障及實際條款放在一起。"
    ]
  }
};

  const scenarioTopics = { threshold: 'threshold', cancel: 'cancel', connection: 'connection', proof: 'proof', ski: 'ski', diving: 'diving', baggage: 'baggage', medical: 'medical' };
  // An authored follow-up with no explicit topic still belongs to its source
  // when it is unique. This also keeps translated buttons routable.
  const offeredPrompts = new Map();
  for (const [id,topic] of Object.entries(topics)) for (const prompt of topic.followUps) {
    const key=prompt.normalize('NFKC').toLowerCase().replace(/[?.!。？！]+$/u,'').trim();
    const parents=offeredPrompts.get(key)||new Set();parents.add(id);offeredPrompts.set(key,parents);
  }
  const sourceTopics = { basic: 'basic', delay: 'delay', medical: 'medical', baggage: 'baggage', sport: 'sport', claim: 'claim' };
  const detectors = [
    ['connection', /\b(connect(?:ing|ion|ions)|layover|missed (?:my |the |a |next |second )?(?:flight|connection)|transfer flight)\b|聯程|轉機|中轉|誤機|錯過轉機|联程|转机|中转|误机/u],
    ['cancel', /\b(cancel(?:led|ed|lation|lations|ation|ling|ing|s)?|canceled)\b|取消/u],
    ['threshold', /\bthreshold\b|\b(?:exactly|precisely|just|only)\s*(?:six|6)\s*(?:hours?|hrs?)\b|\b(?:5|five)\s*(?:hours?|hrs?)\s*(?:50|fifty)\b|\b5\s*h\s*50\b|\b(?:six|6)[ -]?(?:hours?|hrs?).{0,25}\b(?:count|condition|boundary)\b|(?:恰好|刚好)(?:连续)?(?:延误)?\s*(?:6|六)\s*小时|臨界|剛好.*(?:6|六).*小時|恰好.*(?:6|六).*小時|5小時50|五小時五十分|临界|5小时50|五小时五十分/u],
    ['ski', /\bski(?:ing|s|er|ers)?\b|slopes|滑雪/u],
    ['diving', /\b(diving|dive|dives|scuba)\b|潛水|潜水/u],
    ['baggage', /\b(baggage|luggage|suitcase|checked bags?|delayed bags?|essential items?|receipts?)\b|行李|必需品|購物單據|生活用品|购物票据/u],
    ['medical', /\b(medical|hospitals?|providers?|clinics?|doctors?|accidental? injur(?:y|ies))\b|醫療|醫院|就醫|醫療機構|意外受傷|医疗|医院|就医|意外伤害/u],
    ['proof', /\b(screenshots?|notifications?|airline app|proof|carrier certificate|delay certificate|evidence)\b|截圖|通知|延誤證明|承運人證明|證明|截图|通知|延误证明|承运人证明/u],
    ['basic', /\b(?:cover(?:age)?|policy|certificate|period of cover).{0,35}\b(?:starts?|ends?|begins?|effective|dates?)\b|\b(?:start|end|effective).{0,20}\b(?:cover|policy|certificate)\b|\b(?:destination|period of cover)\b|起保|生效|保障期間|目的地|保障期间/u],
    ['claim', /\b(documents?|certificates?|paperwork|supporting|application|apply|submit|filing|claim materials)\b|申請文件|所需文件|需要.*文件|哪些文件|證明文件|索償文件|怎樣申請|申请材料|理赔材料|提交材料|怎么申请/u],
    ['delay', /\b(flight|airline|delay(?:ed|s)?|late flight|compensation)\b|航班|延誤|最高賠|賠多少|延误|最高赔|赔多少/u],
    ['sport', /\b(sports?|activities|activity|high[ -]risk|additional cover|extra cover)\b|運動|活動限制|活動範圍|高風險|附加保障|运动|活动范围|高风险/u]
  ];

  // Scope refusals run before topic matching, so an uploaded PDF or a real
  // purchase request cannot silently turn into a fictional sample answer.
  const outsideScope = [
    /\b(?:my|the|this) (?:uploaded|attached|selected|actual|real) (?:file|pdf|document|policy|contract)\b|\b(?:analyse|analyze|read|review|extract).{0,45}\b(?:upload|attach|my pdf|my file|my policy|my contract)\b|我上傳|我選的|我的(?:保單|合約|文件)|真實(?:保單|合約)|讀取.*(?:pdf|文件)|我上传|我选的|我的(?:保单|合同|文件)|真实(?:保单|合同)|解析.*(?:pdf|文件)|读取.*(?:pdf|文件)/u,
    /\b(?:should i buy|would you buy|recommend (?:a |an |the )?(?:policy|insurance|insurer|product|plan)|best (?:policy|insurance|insurer)|which (?:policy|insurance|insurer) (?:should|to)|compare insurers?|cheapest|premium|price of|buy this|purchase this)\b|推薦(?:買|保險|產品|哪家)|買不買|值得買|哪個保險|哪家保險|保費|推荐(?:买|保险|产品|哪家)|买不买|值得买|哪个保险|哪家保险|保费/u,
    /\b(illness|disease|pre[ -]?existing|pregnan(?:t|cy)|dental|cancer|chronic|mental health|diagnos(?:e|is)|what medicine|treat my|medical advice|treatment advice)\b|疾病|既往症|懷孕|癌症|牙科|慢性病|吃甚麼藥|吃什麼藥|診斷|怀孕|吃什么药|诊断/u,
    /\b(deductible|co[ -]?pay|waiting period|age limit|age restriction|renewal|cooling[ -]?off|policy refund|cancel my policy|cancellation of (?:the |my )?policy|claim deadline|filing deadline)\b|\b(?:how long|time limit).{0,35}\b(?:claim|submit|file)\b|自付額|墊底費|免賠|等待期|年齡限制|續保|退保|報案時限|索償時限|取消(?:我的|這份|該)?(?:保單|保險)|保單取消|免赔|年龄限制|续保|报案时限|理赔时限|取消(?:我的|这份|该)?(?:保单|保险)|保单取消/u,
    /\b(?:how (?:do|can) i|please).{0,20}\bcancel (?:my |the |a )?(?:flight|booking)\b|\btrip cancellation\b|取消訂單|取消預訂|旅行取消|取消(?:旅行|行程)|取消订单|取消预订/u,
    /\b(poem|recipe|weather|stock price|bitcoin|programming|write code|javascript|python|politics|football|horoscope)\b|寫詩|食譜|天氣|股票|比特幣|寫程式|寫代碼|占卜|写诗|菜谱|天气|比特币|写代码/u
  ];

  function contextTopic(context) {
    if (Object.hasOwn(scenarioTopics, context.scenarioId)) return scenarioTopics[context.scenarioId];
    if (Object.hasOwn(sourceTopics, context.sourceId)) return sourceTopics[context.sourceId];
    return null;
  }

  function isContextFollowUp(text) {
    const clean = text.replace(/[?.!。？！]+$/u, '').trim();
    return /^(?:why(?: exactly| is that| does that matter)?|what if|tell me more|more detail(?:s)?|what does (?:this|that|it|this clause|that clause|this wording|the wording|this condition|this benefit|the limit) mean|(?:can you )?(?:explain|clarify|summari[sz]e)(?: this| that| it| this clause| this wording| the wording| this benefit)?(?: in plain english| more simply| please)?|what should i (?:ask|check)|what (?:are|is) (?:the|its|these) (?:conditions|limits|requirements|restrictions|thresholds?)|(?:is|would) (?:that|this|it) (?:be )?covered|does (?:that|this|it) apply|can i claim|will i be paid|how is (?:that|this|it) calculated|how much(?: is the limit| could (?:it|they|this) (?:pay|cover)| can i (?:claim|get)| would i (?:get|receive))?|甚麼意思|什麼意思|為甚麼|為什麼|為何|那是甚麼意思|那是什麼意思|這條是甚麼意思|這條是什麼意思|怎樣理解|具體一點|怎樣問|多少錢|什么意思|为什么|这条是什么意思|怎么理解|具体一点|怎么问|多少钱)$/u.test(clean);
  }

  function unsupported(reason = 'scope') {
    const unavailable = reason === 'unavailable';
    return {
      title: unavailable ? '示例條款暫未載入。' : '這個問題在示例中未有條款依據。',
      paragraphs: unavailable
        ? ['請先開啟示例保單，條款助手須有內置原文，才能把解釋連結至來源。']
        : ['本助手只解釋虛構的晴日旅遊條款，不會分析你選取的檔案、推薦投保或確認真實保障。', '示例未提供這個答案的依據，請把問題保留給保險顧問，並請對方指出適用條款。'],
      sourceIds: [],
      scenarioIds: [],
      followUps: ['航班延誤條件怎樣寫？', '滑雪情況應該怎樣問？', '示例要求哪些文件？'],
      grounded: false
    };
  }

  function reply(question, context = {}) {
    const data = window.PolicyDemo;
    if (!data || !Array.isArray(data.sources) || !data.sources.length) return unsupported('unavailable');
    context = context && typeof context === 'object' ? context : {};
    const text = typeof question === 'string'
      ? question.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
      : '';
    if (!text || outsideScope.some(pattern => pattern.test(text))) return unsupported();

    // Explicit subject words win over the clause that happened to be open.
    const explicit = detectors.find(([, pattern]) => pattern.test(text));
    const offered=offeredPrompts.get(text.replace(/[?.!。？！]+$/u,'').trim());
    const localizedContext=/^(?:關於這項條款[，,]?我應該向顧問確認甚麼|還欠缺哪些資料|關於(?:8|八)小時的條件[，,]?我應該確認甚麼)[。？！?]*$/u.test(text);
    const preciseBasic=/(?:保險(?:憑證|證明書).{0,12}(?:開始|結束|日期|時間|資料|核對)|(?:核對|確認).{0,8}保險(?:憑證|證明書)|保障何時(?:開始|結束))/u.test(text);
    const preciseThreshold=/(?:6|六)\s*小時.{0,10}(?:條件|意思|起算|門檻)/u.test(text);
    const clearOtherTopic=explicit&&!['basic','proof','claim','delay'].includes(explicit[0]);
    const topicId = clearOtherTopic ? explicit[0] : preciseBasic ? 'basic' : preciseThreshold ? 'threshold' : explicit ? explicit[0]
      : isContextFollowUp(text)||localizedContext ? contextTopic(context)
      : offered?.size===1 ? [...offered][0] : null;
    if (!topicId || !Object.hasOwn(topics, topicId)) return unsupported();

    const topic = topics[topicId];
    const mode = ['explain', 'what-if', 'ask'].includes(context.mode) ? context.mode : 'explain';
    const validSources = new Set(data.sources.map(item => item.id));
    const validScenarios = new Set((data.scenarios || []).map(item => item.id));
    const sourceIds = topic.sourceIds.filter(id => validSources.has(id));
    if (!sourceIds.length) return unsupported('unavailable');

    let paragraphs;
    if (mode === 'what-if') paragraphs = [...topic.boundary];
    else if (mode === 'ask') {
      const questionItem = topic.questionId && (data.scenarios || []).find(item => item.id === topic.questionId);
      paragraphs = questionItem
        ? [`可以問：「${questionItem.question}」`, '請對方在回答時一併提供適用條款，未解決的重點繼續保留在問題清單。']
        : [...(topic.ask || topic.explain)];
    } else paragraphs = [...topic.explain];

    return {
      title: topic.title,
      paragraphs,
      sourceIds,
      scenarioIds: topic.scenarioIds.filter(id => validScenarios.has(id)),
      followUps: [...topic.followUps],
      grounded: true
    };
  }

  window.PolicyAgentReplies = { reply };
})();
