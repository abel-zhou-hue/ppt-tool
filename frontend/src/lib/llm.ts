import type { ApiKeys, Deck, Language } from '../types/deck';
import { buildUserMessage, getSystemPrompt } from './prompts';
import {
  DEFAULT_DOUBAO_MODEL,
  ENDPOINTS,
  type ImageProvider,
  type LLMProvider,
} from './registry';

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
  imageProvider: ImageProvider;
  minSlides?: number;
  maxSlides?: number;
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

/**
 * 流式读取 SSE 响应，累积 content，最后从累积文本提取 JSON。
 * 解决：火山方舟同步请求 60s 网关超时（长输出跑不完会关连接）。
 */
async function streamAccumulate(resp: Response): Promise<string> {
  if (!resp.body) throw new Error('响应没有 body 流');
  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE 用 \n\n 分隔事件，行内用 \n
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const chunk = JSON.parse(data);
        const delta = chunk?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') accumulated += delta;
      } catch {
        // 偶发不完整 chunk，忽略继续
      }
    }
  }
  return accumulated;
}

async function callOpenAICompatible(p: OpenAICompatCallParams): Promise<Deck> {
  const body: Record<string, unknown> = {
    model: p.model,
    messages: [
      {
        role: 'system',
        content: getSystemPrompt(p.language, p.imageProvider),
      },
      {
        role: 'user',
        content: buildUserMessage(p.script, p.language, p.minSlides, p.maxSlides),
      },
    ],
    temperature: 0.7,
    max_tokens: 8192,
    stream: true,
  };
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
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `LLM 网络请求失败：${msg}。\n` +
        `常见原因：\n` +
        `1) 模型名 / endpoint ID 不对（齿轮里检查 "${p.model}"）\n` +
        `2) 网络抖动或 CORS 拦截\n` +
        `3) 服务暂时不可用`,
    );
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM 调用失败 (${resp.status}): ${text.slice(0, 300)}`);
  }

  let content: string;
  try {
    content = await streamAccumulate(resp);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`LLM 流式读取失败：${msg}`);
  }
  if (!content.trim()) throw new Error('LLM 流式响应为空');

  try {
    return extractJSON(content) as Deck;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`LLM 响应解析失败：${msg}\n前 200 字：${content.slice(0, 200)}`);
  }
}

export async function callLLM(
  provider: LLMProvider,
  script: string,
  language: Language,
  apiKeys: ApiKeys,
  imageProvider: ImageProvider = 'gpt-image-2',
  minSlides?: number,
  maxSlides?: number,
): Promise<Deck> {
  if (provider === 'deepseek') {
    return callOpenAICompatible({
      provider,
      baseUrl: ENDPOINTS.deepseek,
      model: 'deepseek-chat',
      apiKey: requireKey(apiKeys.deepseek_api_key, 'DeepSeek API Key'),
      script,
      language,
      imageProvider,
      minSlides,
      maxSlides,
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
      imageProvider,
      minSlides,
      maxSlides,
    });
  }
  throw new Error(`未知的 LLM provider: ${provider}`);
}
