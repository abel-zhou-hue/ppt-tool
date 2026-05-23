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
  provider: LLMProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  script: string;
  language: Language;
}

function extractJSON(content: string): unknown {
  const trimmed = content.trim();
  // 直接 parse
  try {
    return JSON.parse(trimmed);
  } catch {
    /* keep going */
  }
  // markdown 代码块包裹
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* keep going */
    }
  }
  // 取第一个 { 到最后一个 }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return JSON.parse(trimmed.substring(first, last + 1));
  }
  throw new Error(`无法从 LLM 响应里提取 JSON: ${trimmed.slice(0, 300)}`);
}

async function callOpenAICompatible(p: OpenAICompatCallParams): Promise<Deck> {
  const body: Record<string, unknown> = {
    model: p.model,
    messages: [
      { role: 'system', content: getSystemPrompt(p.language) },
      { role: 'user', content: p.script },
    ],
    temperature: 0.7,
    max_tokens: 8192,
  };
  // 只对已验证支持的 provider 加 response_format。
  // 火山方舟某些 endpoint 对该参数严格，会直接关连接。
  if (p.provider === 'deepseek') {
    body.response_format = { type: 'json_object' };
  }

  let resp: Response;
  try {
    resp = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${p.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `LLM 网络请求失败：${msg}。\n` +
        `常见原因：\n` +
        `1) 模型名 / endpoint ID 不对（齿轮里检查 "${p.model}"，确认你账号有权限调用）\n` +
        `2) 输出过长触发网关超时（试试缩短输入文稿）\n` +
        `3) 服务暂时不可用 / 网络问题`,
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
    return extractJSON(content as string) as Deck;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`LLM 响应解析失败：${msg}`);
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
      provider,
      baseUrl: ENDPOINTS.deepseek,
      model: 'deepseek-chat',
      apiKey: requireKey(apiKeys.deepseek_api_key, 'DeepSeek API Key'),
      script,
      language,
    });
  }
  if (provider === 'doubao') {
    return callOpenAICompatible({
      provider,
      baseUrl: ENDPOINTS.volcanoArk,
      model: (apiKeys.doubao_model || '').trim() || DEFAULT_DOUBAO_MODEL,
      apiKey: requireKey(apiKeys.volcano_ark_api_key, '火山方舟 API Key'),
      script,
      language,
    });
  }
  throw new Error(`未知的 LLM provider: ${provider}`);
}
