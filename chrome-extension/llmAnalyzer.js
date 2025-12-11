/**
 * LLM 分析器 - 使用本機 LLM 進行用戶 Profile 分析
 * 提供 Chrome Prompt API 可用性檢查
 * 提供用戶社群發文風格分析功能
 */

// ==================== LLM 配置 ====================
const OPENAI_MODEL_NAME = 'gpt-4o-mini'; // OpenAI 模型名稱

/**
 * 從 chrome.storage 讀取是否使用本地 LLM
 * @returns {Promise<boolean>}
 */
async function getUseLocalLLM() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['useLocalLLM'], (result) => {
      resolve(result.useLocalLLM === true);
    });
  });
}

/**
 * 從 chrome.storage 讀取 OpenAI API Key
 * @returns {Promise<string|null>}
 */
async function getOpenAIApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['openaiApiKey'], (result) => {
      resolve(result.openaiApiKey || null);
    });
  });
}

const LLM_SYSTEM_PROMPT = '會依照用戶過去的社群回覆與發文，產出用戶profile標籤的分析程式';
const TAG_SAMPLE="生活帳,生活日常,情緒宣洩,憤世抱怨,攻擊發言,酸言酸語,政治帳,立場鮮明,易怒,惡意嘲諷,人身攻擊,溫暖陪伴,真誠分享,情感支持,理性討論,仇恨言論,觀點交流,社會關懷,同理傾聽,價值探索,個人成長";
const UF_KEYWORD="憨鳥,萊爾賴,萊爾校長,綠共,青鳥真是腦殘,賴皮寮,氫鳥,賴清德戒嚴,賴清德獨裁,賴喪,冥禁黨,賴功德"
// ==================== 可用性檢查 ====================

/**
 * 檢查本機 LLM 是否可用
 * @returns {Promise<{available: boolean, status: string, error?: string}>}
 */
async function checkLLMAvailability() {
  try {
    // 檢查 Prompt API 是否存在
    if (typeof LanguageModel === 'undefined') {
      return {
        available: false,
        status: 'unavailable',
        error: 'Prompt API not available. Please use Chrome 127+.'
      };
    }

    console.log('[LLM] Checking availability...');
    const availability = await LanguageModel.availability();
    console.log('[LLM] Availability:', availability);

    if (availability === 'unavailable') {
      return {
        available: false,
        status: 'unavailable',
        error: 'On-device model is not available. Check hardware requirements.'
      };
    }

    return {
      available: true,
      status: availability // 'available', 'downloading', or 'downloadable'
    };
  } catch (error) {
    console.error('[LLM] ❌ Availability check error:', error);
    return {
      available: false,
      status: 'error',
      error: error.message
    };
  }
}

// ==================== OpenAI API 呼叫 ====================

/**
 * 呼叫 OpenAI API
 * @param {string} systemPrompt - 系統提示詞
 * @param {string} userPrompt - 用戶提示詞
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
async function callOpenAI(systemPrompt, userPrompt) {
  try {
    const apiKey = await getOpenAIApiKey();
    
    if (!apiKey) {
      throw new Error('OpenAI API Key 未設定，請在進階功能中設定');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL_NAME,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 2048
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API 錯誤: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    //console.log('[OpenAI] API 回應:', JSON.stringify(data, null, 2));
    
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[OpenAI] 回應中沒有 content，完整回應:', data);
      throw new Error('OpenAI API 回應格式錯誤');
    }

    return {
      success: true,
      content: content.trim()
    };
  } catch (error) {
    console.error('[OpenAI] ❌ Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==================== Profile 分析 ====================

/**
 * 分析用戶 Profile
 * 根據用戶的社群貼文和回覆內容，生成描述用戶風格的標籤
 * @param {string} socialPostContent - 用戶的貼文內容（可選）
 * @param {string} socialReplyContent - 用戶的回覆內容（可選）
 * @param {function} onProgress - 下載進度回調函數（可選）
 * @returns {Promise<{success: boolean, tags?: string, error?: string}>}
 */
async function analyzeUserProfile(socialPostContent, socialReplyContent, onProgress = null) {
  try {
    // 輸入長度限制：取前 4096 個字元
    const MAX_INPUT_LENGTH = 4096;
    if (socialPostContent) {
      socialPostContent = socialPostContent.substring(0, MAX_INPUT_LENGTH);
    }
    if (socialReplyContent) {
      socialReplyContent = socialReplyContent.substring(0, MAX_INPUT_LENGTH);
    }

    // 構建用戶提示詞
    let socialPostTypeString = '';
    let socialContent = '';

    if (socialPostContent) {
      socialPostTypeString += '貼文';
      socialContent += '\n\n作者本人貼文:\n' + socialPostContent;
    }

    if (socialReplyContent) {
      if(socialContent.length > 0) {
        socialPostTypeString += '與';
      }

      if (socialPostTypeString) {
        socialPostTypeString += '回覆他人的貼文';
      }

      socialContent += '\n\n作者回覆他人的貼文:\n' + socialReplyContent;
    }

    // 如果沒有任何內容，返回錯誤
    if (!socialContent) {
      return {
        success: false,
        error: '沒有提供任何貼文或回覆內容進行分析'
      };
    }

  const useLocalLLM = await getUseLocalLLM();

  const userPromptAPILLm="只有當標註『人身攻擊、仇恨言論、統戰言論』，這三個標注，要提供完整的理由，包括是依據使用者哪一個發言或回覆。如果有大量使用到統戰用語（"+UF_KEYWORD+"），或是強化中國併吞台灣的正當性論述，削弱台灣的國家意識，請標注『統戰言論』。\n 重要：請直接輸出 JSON 格式，不要加任何前綴文字或 markdown 標記。格式為：{\"tags\":[{\"tag\":\"標籤名\",\"reason\":\"理由\"}]}。範例：{\"tags\":[{\"tag\":\"生活帳\",\"reason\":\"分享日常瑣事\"},{\"tag\":\"情緒宣洩\",\"reason\":\"常抱怨工作\"}]}。只能用繁體中文，每個標籤2-5個字。";

   const userPromptLocalLLm="不要使用『人身攻擊、仇恨言論、統戰言論』標籤。只需要輸出標籤的結果，每個標籤間用逗號分隔。例如：「生活帳,情緒宣洩」。只能用繁體中文，每個標籤2-5個字.";

    const userPromptFinal = '請參考以下所提供的' + socialPostTypeString + 
      ', 依內容數量排序, 提供五個最貼切描述該用戶社群帳號展現出的風格的標籤 (舉例但不限這些: '+TAG_SAMPLE+'..). '+ ( useLocalLLM ? userPromptLocalLLm : userPromptAPILLm) + '\n\n\n' + 
      socialContent;
      
    // 印出完整 Prompt
    // console.log(`[LLM] 完整 Prompt:\n=== System ===\n${LLM_SYSTEM_PROMPT}\n=== User ===\n${userPromptFinal}`);

    let fullResponse = '';


    
    if (useLocalLLM) {
      // ==================== 使用本地 LLM ====================
      // 先檢查可用性
      const availabilityResult = await checkLLMAvailability();
      
      if (!availabilityResult.available) {
        throw new Error(availabilityResult.error);
      }

      const availability = availabilityResult.status;

      const sessionOptions = {
        initialPrompts: [
          { role: 'system', content: LLM_SYSTEM_PROMPT },
          { role: 'user', content: userPromptFinal }
        ]
      };

      // 下載進度監控
      if (availability === 'downloading' || availability === 'downloadable') {
        console.log('[LLM] Model downloading...');
        sessionOptions.monitor = (monitor) => {
          monitor.addEventListener('downloadprogress', (e) => {
            const progress = Math.round(e.loaded * 100);
            console.log(`[LLM] Download progress: ${progress}%`);
            
            // 如果有提供進度回調，則調用
            if (onProgress && typeof onProgress === 'function') {
              onProgress(progress);
            }
          });
        };
      }

      console.log('[LLM] Creating session...');
      const session = await LanguageModel.create(sessionOptions);

      console.log('[LLM] Generating response...');
      const stream = session.promptStreaming('請開始');

      for await (const chunk of stream) {
        fullResponse += chunk;
      }
    } else {
      // ==================== 使用 OpenAI API ====================
      console.log('[OpenAI] Calling OpenAI API...');
      const openAIResult = await callOpenAI(LLM_SYSTEM_PROMPT, userPromptFinal);
      
      if (!openAIResult.success) {
        throw new Error(openAIResult.error);
      }
      
      fullResponse = openAIResult.content;
    }

    console.log('[LLM] ✅ Generation completed.');
    console.log('====================');
    console.log(fullResponse);
    console.log('====================');

    const MAX_TAGS = 5;
    const MAX_TAG_LENGTH = 6;
    let tagEntries = [];

    if (useLocalLLM) {
      // 本地 LLM：維持原本的「標籤:理由」格式解析
      tagEntries = fullResponse.trim()
        .split(/[,]/)
        .map(entry => {
          const trimmed = entry.trim();
          const colonIndex = trimmed.indexOf(':') !== -1 ? trimmed.indexOf(':') : trimmed.indexOf('：');
          if (colonIndex > 0) {
            const tag = trimmed.substring(0, colonIndex).trim();
            const reason = trimmed.substring(colonIndex + 1).trim();
            return { tag, reason };
          }
          // 如果沒有冒號，整個當作標籤
          return { tag: trimmed, reason: '' };
        })
        .filter(entry => entry.tag.length > 0 && entry.tag.length < MAX_TAG_LENGTH)
        .slice(0, MAX_TAGS);
    } else {
      // OpenAI API：解析 JSON 格式
      try {
        // 移除可能的 markdown 標記
        let jsonStr = fullResponse.trim();
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const parsed = JSON.parse(jsonStr);
        if (parsed.tags && Array.isArray(parsed.tags)) {
          tagEntries = parsed.tags
            .map(item => ({
              tag: (item.tag || '').trim(),
              reason: (item.reason || '').trim()
            }))
            .filter(entry => entry.tag.length > 0 && entry.tag.length < MAX_TAG_LENGTH)
            .slice(0, MAX_TAGS);
        }
      } catch (jsonError) {
        console.warn('[LLM] JSON 解析失敗，嘗試使用舊格式解析:', jsonError);
        // fallback：使用舊的解析方式
        tagEntries = fullResponse.trim()
          .split(/[,]/)
          .map(entry => {
            const trimmed = entry.trim();
            const colonIndex = trimmed.indexOf(':') !== -1 ? trimmed.indexOf(':') : trimmed.indexOf('：');
            if (colonIndex > 0) {
              const tag = trimmed.substring(0, colonIndex).trim();
              const reason = trimmed.substring(colonIndex + 1).trim();
              return { tag, reason };
            }
            return { tag: trimmed, reason: '' };
          })
          .filter(entry => entry.tag.length > 0 && entry.tag.length < MAX_TAG_LENGTH)
          .slice(0, MAX_TAGS);
      }
    }

    // 組合成「標籤:理由」格式的字串
    const processedTags = tagEntries
      .map(entry => entry.reason ? `${entry.tag}:${entry.reason}` : entry.tag)
      .join(',');

    return {
      success: true,
      tags: processedTags
    };

  } catch (error) {
    console.error('[LLM] ❌ Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==================== 導出 ====================
export {
  checkLLMAvailability,
  analyzeUserProfile
};
