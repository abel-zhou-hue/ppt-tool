import type { Language } from '../types/deck';

const SYSTEM_PROMPT_ZH = `你是 PPT 内容设计师。用户会给你一份文稿，你的任务是把它拆解成多张 PPT 页面（通常 5-12 页），每页用一小段简洁中文表达，并提供整套 PPT 的视觉风格描述。这些 slide_script 接下来会被图像模型直接渲染成 16:9 的 PPT 图片，所以每页文字必须短、清晰、便于排版。

# 任务一：拆分为 N 页 slide
每页输出：
- id: 字符串，"s1", "s2", ... 递增
- slide_script: 50-100 字。这一页要在 PPT 上显示的核心内容。可以是几个要点（每点一行）或精炼的一小段话。注意：图像模型对长文本渲染不稳，所以宁短勿长。严格基于原文稿，不编造、不扩写。

# 任务二：设计整套 PPT 的视觉风格
- style_description: 至少 50 字，详细描述视觉风格，包括：色调、版面、装饰元素、字体感觉、整体氛围、构图原则。所有页将共用这套风格，所以要具体到能直接引导图像模型出图。例如："深蓝灰色商务风，简洁现代主义版面，几何装饰元素，无衬线字体加粗标题，留白充足，构图均衡居中，整体专业克制，背景浅灰带细微纹理"。

# 严格约束
1. 严格基于原文稿内容，不增加任何信息
2. 每页 slide_script 必须简短（50-100 字之间，宁短勿长）
3. style_description 必须详细，至少 50 字
4. 字段名小写下划线，与下方 JSON Schema 完全一致
5. 直接输出 JSON 对象，不要任何额外文字、不要 markdown 代码块标记

# 输出 JSON Schema
{
  "language": "zh",
  "slides": [
    {"id": "s1", "slide_script": "..."},
    {"id": "s2", "slide_script": "..."}
  ],
  "style_description": "..."
}`;

const SYSTEM_PROMPT_EN = `You are a PPT content designer. The user will give you a script. Break it into N PPT pages (typically 5-12) and write a short, clear text for each, plus a unified visual style description for the whole deck. Each slide_script will later be rendered directly by an image model into a 16:9 slide image, so it must be short, clear, and easy to lay out.

# Task 1: Break into N slides
For each slide output:
- id: string, "s1", "s2", ... incrementing
- slide_script: 50-100 characters (or roughly 10-25 English words). The core content to display on this slide. Can be a few key points (one per line) or a tight short paragraph. Image models struggle with long text — keep it short. Stay strictly faithful to the source; do not invent or pad.

# Task 2: Design unified visual style
- style_description: at least 50 characters. Detailed visual style description including: color palette, layout, decorative elements, typography feeling, overall atmosphere, composition principle. All slides share this style, so be specific enough to directly guide the image model. e.g., "Deep navy + warm grey business style, minimalist modern layout, geometric accents, bold sans-serif headlines, generous whitespace, balanced centered composition, professionally restrained tone".

# Strict constraints
1. Stay strictly faithful to the source; do not invent
2. Each slide_script must be short (50-100 chars; short rather than long)
3. style_description must be detailed (50+ chars)
4. Field names lowercase with underscores, matching the JSON schema exactly
5. Output JSON only — no extra text, no markdown code fences

# Output JSON Schema
{
  "language": "en",
  "slides": [
    {"id": "s1", "slide_script": "..."},
    {"id": "s2", "slide_script": "..."}
  ],
  "style_description": "..."
}`;

export function getSystemPrompt(language: Language): string {
  return language === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH;
}

export function buildImagePrompt(
  slideScript: string,
  style: string,
  language: Language,
  hasReference = false,
): string {
  if (language === 'en') {
    const refClause = hasReference
      ? `IMPORTANT: Use the reference image ONLY for visual style consistency (colors, design vocabulary, atmosphere). The text content and specific layout MUST be different — do NOT copy, repeat, or include any text from the reference image.\n\n`
      : '';
    return (
      `Design this as an INFOGRAPHIC-style 16:9 presentation slide (data visualization / card-based design, NOT a plain text slide).\n\n` +
      refClause +
      `# Design principles (MUST follow):\n` +
      `- **Visual-first**: Translate key information into visual elements — icons, illustrations, rounded cards, big number callouts, comparison blocks, simple charts, flow arrows — instead of blocks of plain text\n` +
      `- **Card-based layout**: Use colored blocks or rounded cards to group different points; vary card sizes for hierarchy\n` +
      `- **Icon-paired**: Each key point gets a relevant icon (line or filled style)\n` +
      `- **Strong hierarchy**: Big bold keywords or numbers + small explanatory text; use color contrast to emphasize\n` +
      `- **Generous whitespace**: Low information density; better to show less than cram everything\n` +
      `- **Concise text**: Only 3-6 short keywords or phrases visible; avoid long sentences\n` +
      `- **No headline repetition**: Don't repeat the title twice or fill the slide with a single block of text\n\n` +
      `Visual style: ${style}\n\n` +
      `Source content (transform into an infographic — do NOT just typeset it as paragraphs):\n${slideScript}`
    );
  }
  const refClause = hasReference
    ? `**重要**：参考图仅用来学习视觉风格的一致性（配色、设计语言、氛围）。这一页的**文字内容和具体版面必须不同**——不要复制、不要重复、不要包含参考图里出现的任何文字。\n\n`
    : '';
  return (
    `把以下内容设计为一张**信息图风格**的 16:9 PPT 幻灯片（infographic / 卡片化设计，**不是**普通的文字铺排幻灯片）。\n\n` +
    refClause +
    `# 设计原则（必须遵守）：\n` +
    `- **可视化优先**：把关键信息转换成视觉元素——图标、插画、圆角卡片、大数字标签、对比色块、简单图表、流程箭头——而不是堆砌文字段落\n` +
    `- **卡片化布局**：用色块或圆角卡片把不同要点分组；卡片大小可错落形成层次\n` +
    `- **图标搭配**：每个核心要点都搭配一个相关图标（线性或填充风格均可）\n` +
    `- **强对比层次**：大字号粗体放关键词或数字，小字号放解释文字，配合颜色对比突出重点\n` +
    `- **留白充足**：信息密度要低，宁可少展示几个要点，也不要把版面塞满\n` +
    `- **文字精炼**：可见文字总量控制在 3-6 个短关键词或短语，避免完整长句\n` +
    `- **不要重复标题**：不要把标题写两遍，不要把整页变成一大段文字\n\n` +
    `视觉风格：${style}\n\n` +
    `要表达的原始内容（请转化为信息图，**不要**直接铺排成段落）：\n${slideScript}`
  );
}
