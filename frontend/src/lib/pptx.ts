import pptxgen from 'pptxgenjs';
import type { Deck } from '../types/deck';
import { loadApiKeys } from '../api/client';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

function viaProxy(url: string, proxy: string): string {
  // 支持两种代理形式：
  //   1) 单参数形式：https://my-proxy.workers.dev/?url=<target>
  //   2) 前缀形式：https://my-proxy.workers.dev/proxy?url=<target>
  // 用户填的 proxy 末尾可能带或不带 / 或 ?；统一处理
  const sep = proxy.includes('?') ? '&' : '?';
  return `${proxy}${sep}url=${encodeURIComponent(url)}`;
}

async function fetchAsDataUri(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * 尝试直连；失败时回落到 CORS 代理（如果用户配了）。
 */
async function fetchImageAsDataUri(url: string): Promise<string> {
  try {
    return await fetchAsDataUri(url);
  } catch (e) {
    const proxy = (loadApiKeys().cors_proxy_url || '').trim();
    if (!proxy) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `下载失败（CORS 受限？）：${msg}。Seedream 图片需要在 Settings 里配 CORS 代理才能嵌入 PPT。`,
      );
    }
    return await fetchAsDataUri(viaProxy(url, proxy));
  }
}

function renderFallback(slide: pptxgen.Slide, text: string, prefix: string): void {
  slide.background = { color: 'F5F5F5' };
  slide.addText(`${prefix}\n\n${text}`, {
    x: 0.5,
    y: 2.5,
    w: SLIDE_W - 1,
    h: 2.5,
    fontSize: 20,
    color: '333333',
    align: 'center',
    valign: 'middle',
    fontFace: 'PingFang SC',
  });
}

export async function downloadDeckAsPptx(
  deck: Deck,
  filename = 'deck.pptx',
): Promise<void> {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5

  for (const slide of deck.slides) {
    const s = pres.addSlide();

    if (slide.image_url) {
      try {
        const dataUri = await fetchImageAsDataUri(slide.image_url);
        s.addImage({
          data: dataUri,
          x: 0,
          y: 0,
          w: SLIDE_W,
          h: SLIDE_H,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        renderFallback(s, slide.slide_script, `[图像嵌入失败: ${msg}]`);
      }
    } else {
      renderFallback(s, slide.slide_script, '[图像未生成]');
    }
  }

  await pres.writeFile({ fileName: filename });
}
