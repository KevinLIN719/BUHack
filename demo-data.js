/* 虛構示例資料；所有來源與情境 ID 維持穩定。 */
window.PolicyDemo = {
  "policy": {
    "name": "晴日旅遊／示例保單",
    "insurer": "虛構產品／不供投保",
    "version": "示例保單條款 v1.0",
    "filename": "晴日旅遊示例條款.pdf",
    "disclaimer": "本報告使用虛構條款及預設示例資料，並未分析你在本機選取的檔案，亦不代表任何真實保單的保障範圍或索償資格。"
  },
  "sources": [
    {
      "id": "basic",
      "title": "保障適用的時間與地點",
      "page": 1,
      "section": "第 1 節／保障期間",
      "text": "本示例保單的保障期間，以保險憑證所列的開始及結束時間為準。受保人必須在該期間內，於憑證所列的目的地旅遊。各項保障亦受其個別條件約束。投保前請核對日期、時間及目的地。"
    },
    {
      "id": "delay",
      "title": "航班延誤",
      "page": 2,
      "section": "第 2 節／航班延誤保障",
      "text": "受保航班若連續延誤超過 6 小時，本示例保障按每連續 6 小時支付人民幣 200 元，保障期間內累計上限為人民幣 1,000 元。申請時必須提供承運人簽發的延誤證明。本示例條款未進一步界定準確的時間門檻，亦未說明航班取消或錯過轉機的處理方式。"
    },
    {
      "id": "medical",
      "title": "海外意外醫療費用",
      "page": 3,
      "section": "第 3 節／意外醫療保障",
      "text": "受保人若於保障期間內在旅遊目的地遭受意外受傷，符合本保障條件的海外醫療費用，累計上限為人民幣 200,000 元。治療必須符合指定醫療機構及合資格費用的要求。本示例資料未附醫療機構名單及費用細則，投保前應先索取。"
    },
    {
      "id": "baggage",
      "title": "託運行李延誤",
      "page": 4,
      "section": "第 4 節／行李延誤保障",
      "text": "隨行託運行李若於受保人抵達目的地超過 8 小時後才送達，等候期間購買必需品的實際開支可提交申請報銷，累計上限為人民幣 1,000 元。必須提供承運人簽發的行李延誤證明及相關購物單據。此項保障的其他條件亦同時適用。"
    },
    {
      "id": "sport",
      "title": "活動限制",
      "page": 5,
      "section": "第 5 節／活動限制",
      "text": "因高風險運動、專業或競賽活動引致的損失，不屬本示例保單的基本保障。滑雪比賽及競賽潛水列為此類活動。本示例資料未直接說明一般滑雪場的休閒滑雪、滑雪課程或休閒潛水是否受保。請確認上述活動是否屬保障範圍，以及是否需要附加保障。"
    },
    {
      "id": "claim",
      "title": "申請所需文件",
      "page": 6,
      "section": "第 6 節／證明文件",
      "text": "申請時須提交保險憑證、相關旅遊行程，以及各項保障指定的文件。航班延誤申請須有承運人簽發的延誤證明。行李延誤申請須有承運人簽發的行李延誤證明及相關購物單據。本示例資料未說明航空公司應用程式的通知截圖能否代替承運人簽發的證明。"
    }
  ],
  "coverage": [
    {
      "id": "basic",
      "title": "保障何時開始",
      "amount": "核對保險憑證",
      "summary": "先核對開始及結束時間與目的地，再閱讀各項保障的條件。",
      "status": "In the wording",
      "sourceId": "basic",
      "statusLabel": "條款已列明"
    },
    {
      "id": "delay",
      "title": "航班延誤",
      "amount": "累計上限人民幣 1,000 元",
      "summary": "連續延誤須超過 6 小時；每連續 6 小時支付人民幣 200 元，並須有承運人證明。",
      "status": "In the wording",
      "sourceId": "delay",
      "statusLabel": "條款已列明"
    },
    {
      "id": "medical",
      "title": "海外意外醫療",
      "amount": "累計上限人民幣 200,000 元",
      "summary": "適用於合資格的意外醫療費用，但指定醫療機構名單及費用細則尚未提供。",
      "status": "Needs confirmation",
      "sourceId": "medical",
      "statusLabel": "待確認"
    },
    {
      "id": "baggage",
      "title": "託運行李延誤",
      "amount": "累計上限人民幣 1,000 元",
      "summary": "延誤須超過 8 小時，按必需品的實際開支申請；請保留承運人證明及單據。",
      "status": "In the wording",
      "sourceId": "baggage",
      "statusLabel": "條款已列明"
    },
    {
      "id": "sport",
      "title": "滑雪及其他活動",
      "amount": "先確認活動範圍",
      "summary": "高風險及競賽活動設有限制；休閒滑雪及課程未有直接說明。",
      "status": "Needs confirmation",
      "sourceId": "sport",
      "statusLabel": "待確認"
    },
    {
      "id": "claim",
      "title": "需要準備的文件",
      "amount": "按個別保障備妥證明",
      "summary": "保留憑證、行程及各項保障要求的文件；航班延誤須有承運人證明。",
      "status": "In the wording",
      "sourceId": "claim",
      "statusLabel": "條款已列明"
    }
  ],
  "comparisons": [
    {
      "id": "delay-marketing",
      "claim": "航班延誤，最高人民幣 1,000 元。",
      "detail": "條款訂明延誤門檻及證明要求：每連續 6 小時支付人民幣 200 元，累計上限人民幣 1,000 元。",
      "note": "宣傳的金額是累計上限，請一併核對觸發條件、計算方式及證明文件。",
      "sourceId": "delay"
    },
    {
      "id": "ski-marketing",
      "claim": "安心享受滑雪旅程。",
      "detail": "條款限制高風險、專業及競賽活動，未直接說明一般休閒滑雪或課程。",
      "note": "具體描述你計劃參加的活動，並請對方指出適用條款。",
      "sourceId": "sport"
    },
    {
      "id": "medical-marketing",
      "claim": "海外醫療費用保障人民幣 200,000 元。",
      "detail": "對應保障屬意外醫療費用；人民幣 200,000 元是累計上限，另有醫療機構及費用條件。",
      "note": "使用這項宣傳金額作判斷前，先確認醫療費用類別、合資格機構及缺少的費用細則。",
      "sourceId": "medical"
    }
  ],
  "scenarios": [
    {
      "id": "threshold",
      "title": "剛好延誤六小時，怎樣計算？",
      "context": "航班較原定時間遲了剛好 6 小時起飛。",
      "why": "示例條款寫「超過 6 小時」，但未進一步界定準確門檻或延誤的起算方式。",
      "status": "Needs confirmation",
      "sourceId": "delay",
      "question": "條款寫明須連續延誤超過 6 小時。如果剛好延誤 6 小時，是否符合條件？計算時採用甚麼開始及結束時間？",
      "tags": [
        "flight"
      ],
      "statusLabel": "待確認"
    },
    {
      "id": "cancel",
      "title": "先延誤，之後取消。",
      "context": "航班延誤數小時後，航空公司決定取消航班。",
      "why": "示例資料未直接解釋先延誤後取消的處理方式，不能據此判定是否受保。",
      "status": "Not found",
      "sourceId": "delay",
      "question": "如果航班先延誤、其後取消，應適用哪項保障？已產生的延誤時間怎樣處理？請指出相關條款或補充未提供的說明。",
      "tags": [
        "flight"
      ],
      "statusLabel": "未找到"
    },
    {
      "id": "connection",
      "title": "首程延誤，錯過轉機。",
      "context": "聯程行程的首班航機延誤，令你趕不上下一班航機。",
      "why": "示例資料未直接說明錯過轉機、後續安排或聯程延誤時間的計算方法。",
      "status": "Not found",
      "sourceId": "delay",
      "question": "如果首程延誤令我錯過轉機，這項保障是否適用？延誤時間從何時開始計算，需要甚麼證明？",
      "tags": [
        "flight",
        "connection"
      ],
      "statusLabel": "未找到"
    },
    {
      "id": "proof",
      "title": "航空公司通知截圖足夠嗎？",
      "context": "你已保留航空公司應用程式的延誤通知，但沒有獨立證明。",
      "why": "條款要求承運人簽發的證明，未說明應用程式截圖能否代替該文件。",
      "status": "Needs confirmation",
      "sourceId": "claim",
      "question": "航空公司應用程式的延誤通知截圖，可以代替承運人簽發的延誤證明嗎？如果不可以，應怎樣取得符合要求的文件？",
      "tags": [
        "flight"
      ],
      "statusLabel": "待確認"
    },
    {
      "id": "ski",
      "title": "一天滑雪，保障範圍要問清。",
      "context": "你計劃在一般滑雪場休閒滑雪，也可能參加初學課程。",
      "why": "示例條款限制高風險及競賽活動，但未直接界定休閒滑雪或課程的保障範圍。",
      "status": "Needs confirmation",
      "sourceId": "sport",
      "question": "我計劃在一般滑雪場休閒滑雪，也可能參加初學課程。這兩種活動是否屬保障範圍？是否需要附加保障？請指出適用條款。",
      "tags": [
        "ski"
      ],
      "statusLabel": "待確認"
    },
    {
      "id": "medical",
      "title": "哪些醫療機構及費用符合要求？",
      "context": "你在海外意外受傷，需要尋找醫療機構。",
      "why": "條款設有指定機構及費用條件，但示例資料未附機構名單及費用細則。",
      "status": "Not found",
      "sourceId": "medical",
      "question": "請提供海外意外醫療保障的指定機構名單及合資格費用細則。我應如何核對醫療機構及相關費用是否符合保單要求？",
      "tags": [
        "medical"
      ],
      "statusLabel": "未找到"
    },
    {
      "id": "diving",
      "title": "休閒潛水，也要再看清。",
      "context": "你計劃在旅途中參加休閒潛水活動。",
      "why": "示例條款限制高風險及競賽活動，但未直接說明休閒潛水。",
      "status": "Needs confirmation",
      "sourceId": "sport",
      "question": "我計劃在旅途中休閒潛水，這項活動是否屬保障範圍？有哪些活動條件，是否需要附加保障？請指出相關條款。",
      "tags": [
        "diving"
      ],
      "statusLabel": "待確認"
    },
    {
      "id": "baggage",
      "title": "行李遲到，該保留甚麼？",
      "context": "託運行李延誤超過 8 小時，你在等候期間購買必需品。",
      "why": "示例條款要求承運人簽發的行李延誤證明及購物單據，另設實際開支及累計上限條件。",
      "status": "In the wording",
      "sourceId": "baggage",
      "question": "如果託運行李延誤超過 8 小時，我會保留承運人簽發的延誤證明及必需品單據，還需要提交哪些文件或資料？",
      "tags": [
        "baggage"
      ],
      "statusLabel": "條款已列明"
    }
  ]
};
