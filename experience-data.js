/* One local policy source for the connected mock experience. Every source
 * quote is the literal wording from PolicyFixtures, never an inferred clause. */
(() => {
  'use strict';
  const items = window.PolicyFixtures?.items || Object.freeze([]);
  const findPolicy = id => items.find(item => item.id === id);
  const clean = value => String(value || '').trim();
  // Keep Chinese letters when normalising; an unrelated Chinese query must
  // never collapse to an empty string and match a different clause.
  const normal = value => clean(value).toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const topics = Object.freeze({
    'travel-cancellation': /\b(cancel|cancellation|listed event|booking date|booked)\b|取消行程|取消旅程|取消|預訂日期|列明事件/,
    'travel-baggage': /\b(baggage|bag|bags|luggage|lost bag|lost luggage|ownership|24 hours|reporting|report|evidence|receipt)\b|行李|物品擁有權|擁有權證明|報告|報失|證明|單據|24\s*小時/,
    'travel-activities': /\b(winter sport|winter sports|activity|activities|extension|ski|skiing|ski lesson|diving)\b|冬季運動|滑雪|滑雪班|滑雪課程|潛水|活動|附加保障|加保/,
    'travel-excess': /\b(excess|deductible|150|small claim|small baggage claim)\b|墊底費|自付額|自負額|免賠額|小額索償/,
    'home-unoccupied': /\b(empty|unoccupied|unattended|30 days|30 consecutive days|away from home|six weeks)\b|空置|無人居住|離家|六星期|六週|30\s*天/,
    'home-valuables': /\b(valuable|valuables|2000|2 000|camera|individually listed|belongings)\b|貴重物品|高價物品|相機|逐項列明|逐項申報/,
    'home-extension': /\b(accident|accidental|accidental damage|extension|spill|spilled|damage)\b|意外損毀|意外損壞|附加保障|打翻|潑到|濺到/,
    'home-value': /\b(receipt|receipts|record|records|value|replacement|evidence)\b|單據|收據|價值紀錄|價值證明|重置|購買紀錄/,
    'health-waiting': /\b(wait|waiting|60 days|sixty|planned treatment|first 60|procedure)\b|等候期|等待期|60\s*天|六十天|計劃治療|預定治療/,
    'health-disclosure': /\b(disclose|disclosure|symptom|symptoms|existing|condition|conditions|pain)\b|披露|申報病況|症狀|病況|痛楚|病歷/,
    'health-authorisation': /\b(authorisation|authorization|hospital|emergency|admission|approval)\b|預先批核|事先批核|批核|住院|入院|緊急情況|授權/,
    'health-referral': /\b(referral|letter|specialist|consultation|consultations)\b|轉介信|轉介|專科|診症/
  });
  const genericFollowup = /^(why|why is that|why does that matter|what does that mean|what should i ask|what should i confirm|how should i ask|can you explain that|explain that|tell me more|what about that|which wording supports that|what is the source)( please)?$|^(為甚麼|為什麼|點解|這是甚麼意思|這是什麼意思|是甚麼意思|可以解釋一下嗎|可否解釋一下|請解釋一下|說清楚一點|我應問甚麼|我應確認甚麼|我應如何問|依據是甚麼|哪段條款支持這個說法|原文在哪裏|原文在哪裡|這項保障要符合甚麼條件|如果發生這個情況 還要確認甚麼|關於這項條款 我應如何問)$/;
  // Distinct subjects outrank words shared by many kinds of conditions.
  const specificTopics = Object.freeze({
    ...topics,
    'travel-baggage': /\b(baggage|bag|bags|luggage|lost bag|lost luggage|ownership|24 hours)\b|行李|物品擁有權|擁有權|24\s*小時/,
    'health-waiting': /\b(wait|waiting|60 days|sixty|first 60)\b|等候期|等待期|60\s*天|六十天/,
    'health-disclosure': /\b(disclose|disclosure|symptom|symptoms|existing condition|pain)\b|披露|申報病況|症狀|已有病況|既有病況|痛楚|病歷/
  });
  const explanations = Object.freeze({
    'travel-cancellation': [
      '這份示例只在預訂後發生列明事件時，才提供取消行程保障，並不表示任何行程變動都符合條件。',
      '這段原文沒有附上事件清單。請先索取清單，並說明實際取消原因，再確認相關保障是否適用。'
    ],
    'travel-baggage': [
      '示例要求提供物品擁有權證明，並在 24 小時內報告。兩項條件都需要分別準備。',
      '原文沒有說明報告途徑或接受哪些證明。請確認應向誰報告、時限從何時起計，以及哪些文件獲接納。'
    ],
    'travel-activities': [
      '示例原文排除冬季運動，除非保單附表列明已加保相關活動。目的地本身不能證明已包含這項附加保障。',
      '請具體說明計劃參與的活動，並要求指出相應的保單附表項目。這段原文亦沒有釐清休閒潛水等其他活動。'
    ],
    'travel-excess': [
      '示例對每宗獲接納的行李索償收取 150 個示例金額單位的墊底費。小額索償應一併考慮這項扣減，但條款並不保證索償必獲接納。',
      '請確認墊底費如何計算，以及其他限額或條件如何影響這次損失。這段原文並不包含完整的賠償計算方式。'
    ],
    'home-unoccupied': [
      '示例在住所連續空置 30 天後暫停盜竊保障。因此，長時間離家前應先確認這項限制。',
      '原文沒有定義何謂有人居住，也沒有說明如何延長期限。請按實際離家安排，確認所需措施及書面確認。'
    ],
    'home-valuables': [
      '示例要求每件價值超過 2,000 個示例金額單位的貴重物品，都在保單附表內逐項列明。門檻針對每件物品，而不只是家居財物的總值。',
      '請確認哪些物品符合定義、需要甚麼估值證明，以及如何核對保單附表已完成更新。'
    ],
    'home-extension': [
      '示例只有在已選擇相關附加保障時，才保障意外損毀。單憑一般家居財物保障的描述，不能確認已作出這項選擇。',
      '請核對保單附表，並具體說明意外經過。原文沒有定義所有意外損失，也不保證打翻飲品造成的損壞必定受保。'
    ],
    'home-value': [
      '示例評估索償時會參考價值證明及重置規定。保留紀錄，有助你提出更具體的問題。',
      '原文沒有載明完整的重置規則或認可文件清單。請確認需要保留哪些收據、估值報告或其他紀錄。'
    ],
    'health-waiting': [
      '除非列明例外情況，示例不保障保單生效首 60 天內的計劃治療。因此，接受治療的日期是投保前應確認的重點。',
      '原文沒有列出例外情況，也沒有解釋生效日期如何起計。請確認計劃治療是否符合列明例外，並索取確切條款。'
    ],
    'health-disclosure': [
      '示例要求在保單生效前披露已有症狀及病況；要求不只涉及已確診的疾病，也包括症狀。',
      '請按個人情況確認需要提供哪些資料、日期及文件。本介面不會判斷某次健康披露是否完整。'
    ],
    'health-authorisation': [
      '示例要求住院治療事先獲得批核，緊急情況除外。計劃入院時，應提早確認批核程序。',
      '原文沒有定義緊急情況，也沒有提供申請流程。請確認聯絡人、所需文件，以及書面批核如何發出。'
    ],
    'health-referral': [
      '示例要求專科診症提供轉介信。直接向專科醫生預約，並不會免除這項文件要求。',
      '原文沒有說明轉介信可由誰發出或有效期多久。請在預約前先確認這些細節。'
    ]
  });
  function scenarios(policyId, context = {}) {
    const policy = findPolicy(policyId);
    if (!policy) return [];
    const destinationNames = { Japan:'日本', 'United Kingdom':'英國', 'Hong Kong':'香港', 'Somewhere else':'其他目的地' };
    const destination = destinationNames[clean(context.destination)] || clean(context.destination) || '目的地';
    const family = context.traveller === 'Family';
    const activities = Array.isArray(context.activities) ? context.activities : [];
    const scenes = {
      'travel-cancellation': `預訂前往${destination}的${family ? '家庭旅程' : '旅程'}後，情況有變，你可能需要取消行程。`,
      'travel-baggage': `前往${destination}期間，一件行李遺失。你需要確認報告途徑，以及應保留哪些物品擁有權紀錄。`,
      'travel-activities': activities.includes('skiing') ? `你計劃在${destination}參加入門滑雪課程，但尚未核對保單附表是否列明相關活動的附加保障。` : activities.includes('diving') ? '你考慮參與休閒潛水。現有活動條款只提及冬季運動，因此需要另外確認潛水的保障範圍。' : '城市短途旅行期間，你考慮臨時加插一天冬季運動，這項活動並不在原先計劃內。',
      'travel-excess': '行李的小額損失可能只比 150 個示例金額單位略高。作決定前，你想先了解墊底費的影響。',
      'home-unoccupied': `你計劃讓住所空置六星期${destination !== '目的地' ? `，期間前往${destination}` : ''}，但尚未核對空置條件。`,
      'home-valuables': '一部相機價值 2,400 個示例金額單位，但你在保單附表內找不到逐項列明的紀錄。',
      'home-extension': `${family ? '一位家人' : '你'}不慎將飲品打翻在手提電腦上，但尚未核對有否選擇意外損毀保障。`,
      'home-value': '你仍然保留舊收據，但物品的重置價格已經改變。你想確認哪些價值紀錄仍有幫助。',
      'health-waiting': '一項計劃治療安排在保單生效後第 40 天，但你尚未核對有否列明的等候期例外情況。',
      'health-disclosure': '保單生效前，你已出現反覆症狀，但尚未有最終診斷。你想確認需要披露哪些資料。',
      'health-authorisation': '醫院建議安排非緊急入院治療。你想在治療日期前辦妥所需的預先批核。',
      'health-referral': '你可以直接向專科醫生預約，但目前沒有轉介信。你想先確認文件要求。'
    };
    return policy.findings.slice().sort((a,b) => a.priority - b.priority).map(finding => Object.freeze({
      id: `scenario-${finding.id}`, findingId: finding.id, title: finding.title,
      scene: scenes[finding.id], why: explanations[finding.id]?.[0] || '請細閱條件，並確認哪些細節適用於你的情況。',
      question: finding.question, quote: finding.quote, priority: finding.priority
    }));
  }
  function reply(policyId, question, { findingId = null, mode = 'explain', context = {} } = {}) {
    const policy = findPolicy(policyId), text = clean(question), query = normal(text);
    let finding = query ? policy?.findings.find(item => [item.question,item.title,item.quote].some(value => normal(value) === query)) : null;
    if (!finding && policy) {
      const candidates = policy.findings.filter(item=>specificTopics[item.id]?.test(query));
      if(candidates.some(item=>item.id==='travel-excess'))finding=candidates.find(item=>item.id==='travel-excess');
      else if(candidates.length===1)finding=candidates[0];
      else if(candidates.length>1)finding=candidates.find(item=>item.id===findingId);
      else {
        const broad = policy.findings.filter(item=>topics[item.id]?.test(query));
        finding=broad.length===1?broad[0]:broad.find(item=>item.id===findingId);
      }
    }
    if (!finding && policy && genericFollowup.test(query)) finding = policy.findings.find(item => item.id === findingId);
    if (!finding) return Object.freeze({
      grounded:false, title:'這份示例沒有相符的條款。',
      paragraphs:Object.freeze(['這個問題未能對應至所選虛構保單的條件。請選取一項已標示的重點，或提出更具體的條款問題。', '本機示範不會補寫缺漏條款，也不會判定真實保障範圍。']),
      sourceIds:Object.freeze([]), followUps:Object.freeze(policy?.findings.slice(0,2).map(item => item.question) || []),
      findingId:null, question:text, quote:null, priority:null
    });
    const scene = mode === 'what-if' ? scenarios(policyId, context).find(item => item.findingId === finding.id) : null;
    const paragraphs = mode === 'ask'
      ? [`可以問：「${finding.question}」`, `請對方指出「${finding.quote}」適用的完整條款，並以書面確認相關限制及所需文件。`]
      : scene ? [`假設情境：${scene.scene}`, scene.why, `仍需確認：${finding.question}`]
      : explanations[finding.id].slice();
    return Object.freeze({
      grounded:true, title:finding.title,
      paragraphs:Object.freeze(paragraphs),
      sourceIds:Object.freeze([finding.id]),
      followUps:Object.freeze(policy.findings.filter(item => item.id !== finding.id).slice(0,2).map(item => item.question)),
      findingId:finding.id, question:finding.question, quote:finding.quote, priority:finding.priority
    });
  }
  window.PolicyExperienceData = Object.freeze({ items, scenarios, reply });
})();
