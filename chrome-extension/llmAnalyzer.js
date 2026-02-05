/**
 * LLM 分析器 - 使用本機 LLM 進行用戶 Profile 分析
 * 提供 Chrome Prompt API 可用性檢查
 * 提供用戶社群發文風格分析功能
 */

// ==================== LLM 配置 ====================
const OPENAI_MODEL_NAME = 'gpt-5-mini'; // OpenAI 模型名稱
const CLAUDE_MODEL_NAME = 'claude-haiku-4-5-20251001'; // Claude 模型名稱
const OPENROUTER_DEFAULT_MODEL = 'openrouter/free'; // OpenRouter 預設模型名稱

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

/**
 * 從 chrome.storage 讀取 Claude API Key
 * @returns {Promise<string|null>}
 */
async function getClaudeApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['claudeApiKey'], (result) => {
      resolve(result.claudeApiKey || null);
    });
  });
}

/**
 * 從 chrome.storage 讀取 OpenRouter API Key
 * @returns {Promise<string|null>}
 */
async function getOpenRouterApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['openrouterApiKey'], (result) => {
      resolve(result.openrouterApiKey || null);
    });
  });
}

/**
 * 從 chrome.storage 讀取 OpenRouter Model Name
 * @returns {Promise<string>}
 */
async function getOpenRouterModelName() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['openrouterModelName'], (result) => {
      resolve(result.openrouterModelName || OPENROUTER_DEFAULT_MODEL);
    });
  });
}

/**
 * 從 chrome.storage 讀取使用的 LLM Provider
 * @returns {Promise<string>} 'openai', 'claude', 'openrouter', 或 'local'
 */
async function getLLMProvider() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['llmProvider'], (result) => {
      resolve(result.llmProvider || 'openai');
    });
  });
}

const LLM_SYSTEM_PROMPT = '你是一個內容風險與風格標註器。請嚴格依照使用者規則輸出，且只輸出 YAML（不得有任何前綴、說明或 Markdown）。只使用繁體中文。';
const UF_KEYWORD="憨鳥,萊爾賴,萊爾校長,綠共,青鳥真是腦殘,賴皮寮,氫鳥,賴清德戒嚴,賴清德獨裁,賴喪,冥禁黨,賴功德,萊爾,萊爾校長"
const TAG_SAMPLE="生活帳,生活日常,情緒宣洩,憤世抱怨,攻擊發言,酸言酸語,政治帳,立場鮮明,易怒,惡意嘲諷,謾罵,人身攻擊,溫暖陪伴,真誠分享,情感支持,理性討論,仇恨言論,觀點交流,社會關懷,同理傾聽,個人成長, 詐騙風險, 刻意引戰; 相反的屬性：(生活帳 vs 政治帳) , (攻擊發言, 仇恨言論, 易怒,槓精,謾罵,情緒宣洩,刻意引戰,憤世抱怨 vs 理性討論,觀點交流) , (人身攻擊,惡意嘲諷,易怒,槓精,謾罵,情緒宣洩,刻意引戰,憤世抱怨 vs 溫暖陪伴, 真誠分享,情感支持,同理傾聽,個人成長) 等，需擇一不能同時出現。\n分享自身被詐騙經驗，提醒他人避免受騙，要使用「詐騙提醒」tag而非「詐騙風險」";
const ORDER_FIRST_TAGS="槓精,詐騙風險,統戰言論,人身攻擊,仇恨言論"
/**
 * 解析 YAML 格式的標籤列表
 * @param {string} yamlStr - YAML 格式字串
 * @returns {Array<{tag: string, reason: string}>} - 解析後的標籤陣列
 */
function parseYamlTags(yamlStr) {
  let content = yamlStr.trim();
  
  // 移除 markdown 標記
  if (content.startsWith('```yaml')) {
    content = content.replace(/^```yaml\s*/, '').replace(/\s*```$/, '');
  } else if (content.startsWith('```yml')) {
    content = content.replace(/^```yml\s*/, '').replace(/\s*```$/, '');
  } else if (content.startsWith('```')) {
    content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  const result = [];
  const lines = content.split('\n');
  let currentItem = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // 檢查是否為新項目開始 (以 - 開頭)
    if (trimmedLine.startsWith('- ')) {
      // 儲存前一個項目
      if (currentItem) {
        result.push(currentItem);
      }
      currentItem = { tag: '', reason: '' };
      
      // 嘗試解析同一行的 tag
      const tagMatch = trimmedLine.match(/^-\s*tag:\s*["']?(.+?)["']?\s*$/);
      if (tagMatch) {
        currentItem.tag = tagMatch[1].trim();
      }
    } else if (currentItem) {
      // 解析 tag 或 reason
      const tagMatch = trimmedLine.match(/^tag:\s*["']?(.+?)["']?\s*$/);
      const reasonMatch = trimmedLine.match(/^reason:\s*["']?(.+?)["']?\s*$/);
      
      if (tagMatch) {
        currentItem.tag = tagMatch[1].trim();
      } else if (reasonMatch) {
        currentItem.reason = reasonMatch[1].trim();
      }
    }
  }
  
  // 儲存最後一個項目
  if (currentItem) {
    result.push(currentItem);
  }
  
  return result;
}

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

    console.log('[OpenAI] 通過 background 調用 API...');
    
    // 通過 background service worker 調用 API
    const response = await chrome.runtime.sendMessage({
      action: 'callOpenAIAPI',
      systemPrompt: systemPrompt,
      userPrompt: userPrompt,
      apiKey: apiKey,
      modelName: OPENAI_MODEL_NAME
    });

    if (!response.success) {
      throw new Error(response.error || 'OpenAI API 調用失敗');
    }

    return {
      success: true,
      content: response.content
    };
  } catch (error) {
    console.error('[OpenAI] ❌ Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==================== Claude API 呼叫 ====================

/**
 * 呼叫 Claude API
 * @param {string} systemPrompt - 系統提示詞
 * @param {string} userPrompt - 用戶提示詞
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
async function callClaude(systemPrompt, userPrompt) {
  try {
    const apiKey = await getClaudeApiKey();
    
    if (!apiKey) {
      throw new Error('Claude API Key 未設定，請在進階功能中設定');
    }

    console.log('[Claude] 通過 background 調用 API...');
    
    // 通過 background service worker 調用 API
    const response = await chrome.runtime.sendMessage({
      action: 'callClaudeAPI',
      systemPrompt: systemPrompt,
      userPrompt: userPrompt,
      apiKey: apiKey,
      modelName: CLAUDE_MODEL_NAME
    });

    if (!response.success) {
      throw new Error(response.error || 'Claude API 調用失敗');
    }

    return {
      success: true,
      content: response.content
    };
  } catch (error) {
    console.error('[Claude] ❌ Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==================== OpenRouter API 呼叫 ====================

/**
 * 呼叫 OpenRouter API
 * @param {string} systemPrompt - 系統提示詞
 * @param {string} userPrompt - 用戶提示詞
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
async function callOpenRouter(systemPrompt, userPrompt) {
  try {
    const apiKey = await getOpenRouterApiKey();
    const modelName = await getOpenRouterModelName();
    
    if (!apiKey) {
      throw new Error('OpenRouter API Key 未設定，請在進階功能中設定');
    }

    if (!modelName) {
      throw new Error('OpenRouter Model Name 未設定，請在進階功能中設定');
    }

    console.log(`[OpenRouter] 通過 background 調用 API (model: ${modelName})...`);
    
    // 通過 background service worker 調用 API
    const response = await chrome.runtime.sendMessage({
      action: 'callOpenRouterAPI',
      systemPrompt: systemPrompt,
      userPrompt: userPrompt,
      apiKey: apiKey,
      modelName: modelName
    });

    if (!response.success) {
      throw new Error(response.error || 'OpenRouter API 調用失敗');
    }

    return {
      success: true,
      content: response.content
    };
  } catch (error) {
    console.error('[OpenRouter] ❌ Error:', error);
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
 * @param {string} targetUser - 目標用戶名稱（可選）
 * @param {function} onProgress - 下載進度回調函數（可選）
 * @returns {Promise<{success: boolean, tags?: string, error?: string}>}
 */
async function analyzeUserProfile(socialPostContent, socialReplyContent, targetUser = '', onProgress = null) {
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
      socialContent += '\n\n## 以下作者本人貼文:\n' + socialPostContent;
    }

    if (socialReplyContent) {
      if(socialContent.length > 0) {
        socialPostTypeString += '與';
      }

      if (socialPostTypeString) {
        socialPostTypeString += '回覆他人的貼文';
      }

      socialContent += '\n\n## 以下是作者回覆他人的貼文，要看 "'+targetUser+'" 的回覆部分:\n' + socialReplyContent;
    }

    // 如果沒有任何內容，返回錯誤
    if (!socialContent) {
      return {
        success: false,
        error: '沒有提供任何貼文或回覆內容進行分析'
      };
    }

  const useLocalLLM = await getUseLocalLLM();

  const userPromptAPILLm="特殊標註規則：\n- 若有使用到中國統戰意味的用語（例如："+UF_KEYWORD+" 等），或宣傳／呼應中國併吞台灣正當性論述，或削弱台灣民主與國家意識（例如：政府獨裁、中國強大台灣弱小、花那麼多國防經費是美國一直從台灣搬錢走），請一定標註標籤：統戰言論。\n" +
                          "- 若作者回覆他人時出現如「哥哥可以加我的賴聊天嗎」，提供私人帳號或連結引流或誘導行為，像是 t.me 是 telegram的群組連結全部都是色情釣魚詐騙帳號，請標註：詐騙風險。\n"+
                          "- 判斷該留言是否屬於「槓精」：若發言多次以反駁、否定或抬槓為主要目的，且未促進理解或建設性討論；同時具有超過兩個以上的人身攻擊、謾罵、刻意引戰、攻擊性發言或惡意嘲諷的情況，才能標註為槓精\n";

  // 本機所使用的 Nano-LLM , 移除受限於模型能力較弱會造成誤判的規則
   const userPromptLocalLLm="不要使用 槓精,刻意引戰 這兩個標籤";

    const userPromptFinal = '請參考以下所提供的' + socialPostTypeString + 
      ', 依內容數量排序, 提供最多五個不重複的最貼切描述該用戶社群帳號("'+targetUser+'")展現出的風格的標籤 (舉例但不限這些: '+TAG_SAMPLE+'..). \n'+ ( useLocalLLM ? userPromptLocalLLm : userPromptAPILLm) + '\n' + 
      ' 也在 reason 中明確指出所依據的發言或回覆內容 '+
      '重要：請直接輸出 YAML 格式，不要加任何前綴文字或 markdown 標記。格式範例：\n- tag: 生活帳\n  reason: 分享日常瑣事\n- tag: 情緒宣洩\n  reason: 常抱怨工作\n只能用繁體中文，每個標籤2-5個字。\n\n\n' + 
      socialContent;
      
    // 印出完整 Prompt
    //console.log(`[LLM] 完整 Prompt:\n=== System ===\n${LLM_SYSTEM_PROMPT}\n=== User ===\n${userPromptFinal}`);

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
      // ==================== 使用遠端 API (OpenAI、Claude 或 OpenRouter) ====================
      const llmProvider = await getLLMProvider();
      
      if (llmProvider === 'claude') {
        console.log('[Claude] Calling Claude API...');
        const claudeResult = await callClaude(LLM_SYSTEM_PROMPT, userPromptFinal);
        
        if (!claudeResult.success) {
          throw new Error(claudeResult.error);
        }
        
        fullResponse = claudeResult.content;
      } else if (llmProvider === 'openrouter') {
        const modelName = await getOpenRouterModelName();
        console.log(`[OpenRouter] Calling OpenRouter API (model: ${modelName})...`);
        const openRouterResult = await callOpenRouter(LLM_SYSTEM_PROMPT, userPromptFinal);
        
        if (!openRouterResult.success) {
          throw new Error(openRouterResult.error);
        }
        
        fullResponse = openRouterResult.content;
      } else {
        console.log('[OpenAI] Calling OpenAI API...');
        const openAIResult = await callOpenAI(LLM_SYSTEM_PROMPT, userPromptFinal);
        
        if (!openAIResult.success) {
          throw new Error(openAIResult.error);
        }
        
        fullResponse = openAIResult.content;
      }
    }

    console.log('[LLM] ✅ Generation completed.');
    console.log('====================');
    console.log(fullResponse);
    console.log('====================');

    const MAX_TAGS = 5;
    const MAX_TAG_LENGTH = 7;
    let tagEntries = [];

    // 使用 YAML 解析
    const parsedTags = parseYamlTags(fullResponse);
    
    if (parsedTags.length === 0) {
      console.error('[LLM] ❌ YAML 解析失敗，無法取得標籤');
      console.error('[LLM] 原始回應:', fullResponse);
      return {
        success: false,
        error: 'YAML 解析失敗：無法取得標籤'
      };
    }
    
    tagEntries = parsedTags
      .filter(entry => entry.tag.length > 0 && entry.tag.length < MAX_TAG_LENGTH)
      .slice(0, MAX_TAGS);
    console.log('[LLM] 使用 YAML 格式解析成功，取得', tagEntries.length, '個標籤');

    // 組合成「標籤:理由」格式的字串（理由中的半形逗號換成全形）
    const processedTagEntries = tagEntries
      .map(entry => entry.reason ? `${entry.tag}:${entry.reason.replace(/,/g, '，')}` : entry.tag);

    // 將 ORDER_FIRST_TAGS 中的標籤移到最前面
    const orderFirstTagsSet = new Set(ORDER_FIRST_TAGS.split(',').map(t => t.trim()));
    const priorityTags = [];
    const normalTags = [];
    for (const tagStr of processedTagEntries) {
      const tagName = tagStr.split(':')[0];
      if (orderFirstTagsSet.has(tagName)) {
        priorityTags.push(tagStr);
      } else {
        normalTags.push(tagStr);
      }
    }
    const processedTags = [...priorityTags, ...normalTags].join(',');

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
