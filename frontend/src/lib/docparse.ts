import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

/**
 * 把上传的文件解析成纯文本。
 * 支持 .docx / .pdf / .pptx / .txt / .md
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) return extractDocx(file);
  if (name.endsWith('.pdf')) return extractPdf(file);
  if (name.endsWith('.pptx')) return extractPptx(file);
  if (name.endsWith('.txt') || name.endsWith('.md')) return file.text();
  throw new Error(
    `不支持的文件类型：${file.name}。当前支持 .docx / .pdf / .pptx / .txt / .md`,
  );
}

async function extractDocx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value.trim();
}

async function extractPdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
    pages.push(text);
  }
  const combined = pages.join('\n\n').trim();
  if (!combined) {
    throw new Error(
      'PDF 没有可提取的文字层（可能是扫描版 PDF）。当前不支持 OCR，建议先用其他工具转成可选文字的 PDF/Word。',
    );
  }
  return combined;
}

async function extractPptx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files)
    .filter((p) => p.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const ai = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      const bi = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      return ai - bi;
    });

  if (!slideFiles.length) {
    throw new Error('PPTX 文件里没找到 slides，可能格式不标准');
  }

  const parser = new DOMParser();
  const pageTexts: string[] = [];
  for (const path of slideFiles) {
    const xml = await zip.files[path].async('string');
    const doc = parser.parseFromString(xml, 'application/xml');
    const textNodes = Array.from(doc.getElementsByTagName('a:t'));
    const pageText = textNodes
      .map((n) => n.textContent || '')
      .filter((t) => t.trim())
      .join(' ');
    if (pageText.trim()) pageTexts.push(pageText);
  }

  return pageTexts.join('\n\n').trim();
}
