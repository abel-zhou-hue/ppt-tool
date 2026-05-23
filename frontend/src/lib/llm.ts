import type { ApiKeys, Deck, Language } from '../types/deck';
import { getSystemPrompt } from './prompts';
import { DEFAULT_DOUBAO_MODEL, ENDPOINTS, type LLMProvider } from './registry';

function requireKey(value: string | undefined, name: string): string {
  const v = (value || '').trim();
  if (!v) {
    throw new Error(
      `${name} 未配置。请在右上角"齿轮"里填入。`,
    );
  }
  return v;
}

interface OpenAICompatCallParams {
  baseUrl: string;
  model: string;
  apiKey: string;
  script: string;
  language: Language;
}

async function callOpenAICompatible(p: OpenAICompatCallParams): Promise<Deck> {
  let resp: Response;
  try {
    resp = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${p.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: p.model,
        messages: [
          { role: 'system', content: getSystemPrompt(p.language) },
          { role: 'user', content: p.script },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 8192,
      }),
    });
  } catch (e) {
    // fetch 本身失败（网络断、CORS、服务器关连接）
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `LLM 网络请求失败：${msg}。\n` +
        `常见原因：1) 输出过长触发网关超时（试试缩短输入文稿）；` +
        `2) 模型名不对（在齿轮里检查 Doubao 模型名）；` +
        `3) 服务暂时不可用`,
    );
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM 调用失败 (${resp.status}): ${text.slice(0, 300)}`);
  }
  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM 返回为空');
  try {
    return JSON.parse(content) as Deck;
  } catch (e) {
    throw new Error(`LLM 返回的不是合法 JSON: ${(content as string).slice(0, 200)}`);
  }
}

export async function callLLM(
  provider: LLMProvider,
  script: string,
  language: Language,
  apiKeys: ApiKeys,
): Promise<Deck> {
  if (provider === 'deepseek') {
    return callOpenAICompatible({
      baseUrl: ENDPOINTS.deepseek,
      model: 'deepseek-chat',
      apiKey: requireKey(apiKeys.deepseek_api_key, 'DeepSeek API Key'),
      script,
      language,
    });
  }
  if (provider === 'doubao') {
    return callOpenAICompatible({
      baseUrl: ENDPOINTS.volcanoArk,
      model: (apiKeys.doubao_model || '').trim() || DEFAULT_DOUBAO_MODEL,
      apiKey: requireKey(apiKeys.volcano_ark_api_key, '火山方舟 API Key'),
      script,
      language,
    });
  }
  throw new Error(`未知的 LLM provider: ${provider}`);
}
