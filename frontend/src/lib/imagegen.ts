import type { ApiKeys, Deck, Language, Slide } from '../types/deck';
import { buildImagePrompt } from './prompts';
import {
  DEFAULT_SEEDREAM_I2I_MODEL,
  DEFAULT_SEEDREAM_T2I_MODEL,
  ENDPOINTS,
  type ImageProvider,
} from './registry';

function requireKey(value: string | undefined, name: string): string {
  const v = (value || '').trim();
  if (!v) {
    throw new Error(`${name} 未配置。请在右上角"齿轮"里填入。`);
  }
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface GenOptions {
  size?: string;
  resolution?: string;
  referenceImages?: string[];
}

// ====== apimart (gpt-image-2) - async task model ======

async function callApimart(
  prompt: string,
  opts: GenOptions,
  apiKeys: ApiKeys,
): Promise<string> {
  const apiKey = requireKey(apiKeys.apimart_api_key, 'apimart API Key');
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const payload: Record<string, unknown> = {
    model: 'gpt-image-2',
    prompt,
    n: 1,
    size: opts.size || '16:9',
    resolution: opts.resolution || '2k',
  };
  if (opts.referenceImages?.length) {
    payload.image_urls = opts.referenceImages;
  }

  const submitResp = await fetch(`${ENDPOINTS.apimart}/v1/images/generations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!submitResp.ok) {
    throw new Error(
      `apimart 提交失败 (${submitResp.status}): ${(await submitResp.text()).slice(0, 300)}`,
    );
  }
  const submitJson = await submitResp.json();
  const taskId = submitJson?.data?.[0]?.task_id;
  if (!taskId) throw new Error('apimart 未返回 task_id');

  await sleep(12000);
  for (let i = 0; i < 60; i++) {
    const pollResp = await fetch(`${ENDPOINTS.apimart}/v1/tasks/${taskId}`, {
      headers,
    });
    if (!pollResp.ok) {
      throw new Error(`apimart 轮询失败 (${pollResp.status})`);
    }
    const data = (await pollResp.json())?.data;
    const status = data?.status;
    if (status === 'completed') {
      const url = data?.result?.images?.[0]?.url?.[0];
      if (!url) throw new Error('apimart 完成但未返回 URL');
      return url;
    }
    if (status === 'failed') {
      throw new Error(`apimart 生成失败: ${data?.error?.message || 'unknown'}`);
    }
    await sleep(4000);
  }
  throw new Error(`apimart 超时: task_id=${taskId}`);
}

// ====== Seedream (Volcano Engine Ark) - sync ======

// Seedream 3.0 要求最少 3,686,400 像素（~2560×1440）
const SIZE_BY_RES: Record<string, Record<string, string>> = {
  '1k': {
    '16:9': '1536x864',
    '9:16': '864x1536',
    '1:1': '1024x1024',
  },
  '2k': {
    '16:9': '2560x1440',
    '9:16': '1440x2560',
    '1:1': '2048x2048',
  },
  '4k': {
    '16:9': '3840x2160',
    '9:16': '2160x3840',
    '1:1': '2880x2880',
  },
};

function aspectToPixels(size: string, resolution: string): string {
  if (size.includes('x')) return size;
  const bucket = SIZE_BY_RES[resolution] || SIZE_BY_RES['2k'];
  return bucket[size] || '2048x1152';
}

async function callSeedream(
  prompt: string,
  opts: GenOptions,
  apiKeys: ApiKeys,
): Promise<string> {
  const apiKey = requireKey(apiKeys.volcano_ark_api_key, '火山方舟 API Key');
  const pixels = aspectToPixels(opts.size || '16:9', opts.resolution || '2k');

  let model: string;
  const extra: Record<string, unknown> = {};
  if (opts.referenceImages?.length) {
    model =
      (apiKeys.seedream_i2i_model || '').trim() || DEFAULT_SEEDREAM_I2I_MODEL;
    extra.image = opts.referenceImages[0];
  } else {
    model =
      (apiKeys.seedream_t2i_model || '').trim() || DEFAULT_SEEDREAM_T2I_MODEL;
  }

  const resp = await fetch(`${ENDPOINTS.volcanoArk}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      size: pixels,
      response_format: 'url',
      ...extra,
    }),
  });
  if (!resp.ok) {
    throw new Error(
      `Seedream 失败 (${resp.status}): ${(await resp.text()).slice(0, 300)}`,
    );
  }
  const json = await resp.json();
  const url = json?.data?.[0]?.url;
  if (!url) throw new Error('Seedream 未返回 URL');
  return url;
}

// ====== Dispatcher ======

export async function generateImage(
  provider: ImageProvider,
  prompt: string,
  opts: GenOptions,
  apiKeys: ApiKeys,
): Promise<string> {
  if (provider === 'gpt-image-2') return callApimart(prompt, opts, apiKeys);
  if (provider === 'seedream') return callSeedream(prompt, opts, apiKeys);
  throw new Error(`未知的图像 provider: ${provider}`);
}

// ====== Slide-level helper (used by both batch and single-slide regen) ======

function fallbackPrompt(slide: Slide, styleDescription: string): string {
  return `信息图风格 16:9 PPT 幻灯片。\n视觉风格：${styleDescription}\n本页内容：${slide.slide_script}`;
}

export async function generateSingleSlideImage(params: {
  slide: Slide;
  styleDescription: string;
  language: Language;
  anchorImageUrl: string | null | undefined;
  isAnchor: boolean;
  provider: ImageProvider;
  apiKeys: ApiKeys;
  logoDataUri?: string | null;
  materialsByID?: Map<string, { data_uri: string }>;
}): Promise<string> {
  const {
    slide,
    styleDescription,
    language,
    anchorImageUrl,
    isAnchor,
    provider,
    apiKeys,
    logoDataUri,
    materialsByID,
  } = params;

  // 本页相关的素材（按 slide.material_refs 查表）
  const materialUris: string[] = [];
  if (slide.material_refs && materialsByID) {
    for (const id of slide.material_refs) {
      const m = materialsByID.get(id);
      if (m) materialUris.push(m.data_uri);
    }
  }

  // 组装 reference images
  // Seedream 只接受 1 个 ref：优先级 material > logo > anchor
  // gpt-image-2 上限 16：material 优先放前面，然后 anchor 和 logo
  let refsArray: string[] = [];
  if (provider === 'seedream') {
    if (materialUris.length) refsArray.push(materialUris[0]);
    else if (logoDataUri) refsArray.push(logoDataUri);
    else if (!isAnchor && anchorImageUrl) refsArray.push(anchorImageUrl);
  } else {
    refsArray.push(...materialUris);
    if (!isAnchor && anchorImageUrl) refsArray.push(anchorImageUrl);
    if (logoDataUri) refsArray.push(logoDataUri);
    refsArray = refsArray.slice(0, 16);
  }
  const refs = refsArray.length ? refsArray : undefined;

  const fallback = fallbackPrompt(slide, styleDescription);
  const promptGpt = (slide.image_prompt || '').trim() || fallback;
  const promptSeedream = (slide.image_prompt_seedream || '').trim() || undefined;

  const fullPrompt = buildImagePrompt({
    imagePromptGpt: promptGpt,
    imagePromptSeedream: promptSeedream,
    language,
    provider,
    hasReference: !!refs,
    hasLogo: !!logoDataUri,
    hasMaterials: materialUris.length > 0,
  });
  return generateImage(
    provider,
    fullPrompt,
    { size: '16:9', resolution: '2k', referenceImages: refs },
    apiKeys,
  );
}

// ====== Deck-level orchestration: anchor first, then parallel ======

export async function generateDeckImages(
  deck: Deck,
  provider: ImageProvider,
  apiKeys: ApiKeys,
  logoDataUri?: string | null,
  materialsByID?: Map<string, { data_uri: string }>,
): Promise<Deck> {
  if (!deck.slides.length) return deck;
  const updated: Deck = { ...deck, slides: deck.slides.map((s) => ({ ...s })) };
  const style = updated.style_description;
  const lang = updated.language;

  const first = updated.slides[0];
  try {
    const url = await generateSingleSlideImage({
      slide: first,
      styleDescription: style,
      language: lang,
      anchorImageUrl: null,
      isAnchor: true,
      provider,
      apiKeys,
      logoDataUri,
      materialsByID,
    });
    first.image_url = url;
    updated.anchor_image_url = url;
  } catch (e) {
    console.error('Anchor (slide 1) image gen failed:', e);
  }

  const remaining = updated.slides.slice(1);
  if (!remaining.length) return updated;

  await Promise.all(
    remaining.map(async (slide: Slide) => {
      try {
        slide.image_url = await generateSingleSlideImage({
          slide,
          styleDescription: style,
          language: lang,
          anchorImageUrl: updated.anchor_image_url,
          isAnchor: false,
          provider,
          apiKeys,
          logoDataUri,
          materialsByID,
        });
      } catch (e) {
        console.error(`Slide ${slide.id} image gen failed:`, e);
        slide.image_url = null;
      }
    }),
  );

  return updated;
}
