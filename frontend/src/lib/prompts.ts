import type { Language } from '../types/deck';
import type { ImageProvider } from './registry';

const SYSTEM_PROMPT_ZH = `你是 PPT 内容设计师 + 视觉指导。用户给你一份文稿，你的任务是产出一份 JSON，包含三部分内容。

# 任务一：拆分为 N 页 slide（通常 5-12 页）

每页输出**四个字段**：
- id: 字符串，"s1", "s2", ... 递增
- slide_script: 本页详细内容，**120-200 字**。基于原文稿展开本页要表达的观点、事实、细节，可补充自然过渡和必要解释，但严格不偏离原意、不编造事实数字。
- image_prompt: 用于 gpt-image-2 出图（150-250 字）。见任务三 A。
- image_prompt_seedream: 用于 Seedream 出图（**300-450 字，更详细**）。见任务三 B。

# 任务二：设计整套 PPT 的统一视觉风格 + 整套主题

输出两个 deck 级字段：

**deck_title**（必填，4-15 字）：整套 PPT 的主题名，作为下载文件名用，简明扼要概括全部内容。例如"猫咪呕吐应对指南"、"远程办公的演变与未来"、"Q2 业务回顾与展望"。

**style_description**（至少 80 字）：具体到：
- 配色：3-5 个具体色名或十六进制（如"深蓝 #1B3A6B + 米白 #F5F1E8 + 橙红 #E94B3C 强调色"）
- 字体感觉：衬线/无衬线、几何/书法、加粗/纤细
- 版式倾向：卡片化 / 留白多 / 极简 / 信息密集
- 装饰元素：几何线条 / 插画 / 纹理 / 渐变
- 整体氛围：专业 / 温暖 / 科技 / 活力 / 严肃

# 任务三：为每页生成两套 image_prompt

## 🚨 通用要求（两套 prompt 都必须遵守）

### 🌐 语言硬约束（必读）

整套 PPT 的语言由用户在外部选定（"language" 字段）。
- 当 language = "zh"：所有「」内文字**必须是简体中文**。不允许出现日文假名、韩文、繁体字、英文长句。可以保留原文稿本身的英文专业术语（如 pH、UPC），但不要主动加英文。
- 当 language = "en"：所有「」内文字**必须是英文**。绝对不允许出现任何中文字符、日文假名、韩文。

这是图像模型最容易出错的地方（它会把训练数据里的多语言版本混进来），所以两套 image_prompt 都要在文中**明确写出**"all text in English only" / "所有文字必须是简体中文" 类似的硬约束。

### A. 「」引号约定（最重要！）

要在图上**实际显示为文字**的中文（标题、关键词、标签、要点），**必须**用「中文直角引号」括起来。
**没有用「」括起来的所有描述**都是给图像模型的**风格/布局/元素指令**，绘图时不能作为文字渲染。

✅ 正确示例：
"标题「核心要点」居中加粗深蓝色，下方 3 张圆角白色卡片纵向排列，第一张卡片左侧深蓝圆形图标内放白色搜索镜，右侧标题「症状一」深蓝色加粗 + 副标「呕吐物带血」灰色小字。配色用 #1B3A6B 主蓝 + #F5F1E8 米白 + #E94B3C 红色强调。"

❌ 错误示例（不要这样写）：
"标题：核心要点（居中加粗）。卡片一：症状一（配胃图标）。卡片二：症状二（配温度计图标）。"
（没用「」标记，模型会把"症状一""配胃图标""配温度计图标"全部当文字渲染上去）

### B. 紧扣本页 slide_script，不跑题不幻觉
- 「」里的文字必须来自 slide_script，不能编造
- 视觉元素描述要呼应 slide_script 的具体内容

### C. 风格一致，版式有差异
- 配色 / 装饰元素 / 字体感觉 全 deck 统一（复用 style_description 关键词）
- 但布局/构图按本页内容差异化：列表型用图标 grid、对比型用左右分屏、流程型用时间轴、数据型用大数字 callout 等

### D. 铺满 16:9 画布
- 每个 prompt 必须明确"内容铺满整个 16:9 画面"
- 禁止"内容只占一半另一半空白"的失衡构图

---

## 任务三 A：image_prompt（给 gpt-image-2 用，150-250 字）

gpt-image-2 理解抽象设计指令能力强，可以用：
- 设计原则：infographic style, balanced composition, clear hierarchy, generous whitespace
- 排版词汇：grid layout, callout boxes, typography hierarchy, color blocking
- 风格关键词：modern minimalist, editorial design, professional

写法：开头声明类型 + 复用 style_description 关键词 + 用「」标显示文字 + 描述布局结构 + 强调铺满画面

## 任务三 B：image_prompt_seedream（给 Seedream 用，**300-450 字**）

Seedream 对**中国流行的视觉风格描述**特别敏感，但对**抽象英文设计术语**理解很弱。
写 Seedream prompt 时务必：

### 用具体的中国流行词替换抽象英文
| ❌ 不要用 | ✅ 改用 |
|---|---|
| infographic / data viz | 小红书风格科普长图 / 公众号图文卡片 / 中文扁平化海报 |
| hierarchy / typography | 大号粗体中文标题 + 红色高亮关键词 + 小字说明 |
| balanced composition | 顶部 logo 栏 + 中部主图文 + 底部装饰栏 |
| modern minimalist | 深蓝主色 + 米色背景 + 红色强调 + 圆角卡片 |
| icons / illustrations | 手绘感卡通图标 / 可爱 Q 版插画 / 真实照片+插画混搭 |

### 按以下 6 部分详细描述（每部分都不能省）
1. **顶部栏**：是否有 logo、页码、栏目标签，位置和颜色
2. **主标题区**：「主标题文字」字号、颜色、位置；副标题「副标文字」颜色
3. **主体内容**：几个卡片、纵向/横向排列、每个卡片左侧什么图标右侧什么文字（用「」标卡片标题）
4. **辅助插画**：角色（医生/动物/物品）位置、姿态、是真实照片还是 Q 版卡通
5. **底部栏**：服务图标 / 品牌信息 / 分类标签
6. **装饰细节**：背景纹理、爪印、几何线条、渐变色块的具体位置

### Seedream 擅长（多用这些关键词）
小红书风、公众号图文风、宠物科普海报风、中国风插画、可爱手绘、Q 版卡通人物、
真实照片+插画混搭、扁平化、圆角卡片、莫兰迪配色

### Seedream 文字渲染易翻车
- 「」里的中文短句不要超过 10 个字（最理想 4-8 字）
- 关键信息用"短标题词 + 图标"组合
- **绝对不要**把"配 XX 图标""配 XX 插画""（XX 颜色）"这种指令写进「」里

# 严格约束

1. slide_script 严格基于原文，不编造、不扩写超出原意
2. image_prompt 和 image_prompt_seedream 都必须基于本页 slide_script
3. 「」引号约定**两套 prompt 都要严格遵守**
4. 颜色用 hex 格式（#XXXXXX）或具体色名
5. 字段名小写下划线，与下方 JSON Schema 完全一致
6. 直接输出 JSON 对象，**不要任何额外文字、不要 markdown 代码块标记**

# 输出 JSON Schema

{
  "language": "zh",
  "deck_title": "...",
  "slides": [
    {
      "id": "s1",
      "slide_script": "...",
      "image_prompt": "...",
      "image_prompt_seedream": "..."
    }
  ],
  "style_description": "..."
}`;

const SYSTEM_PROMPT_EN = `You are a PPT content designer + visual director. The user will give you a script. Produce a single JSON output with three parts.

# Task 1: Break into N slides (typically 5-12)

For each slide output **four fields**:
- id: string, "s1", "s2", ... incrementing
- slide_script: detailed page content, **30-50 English words (or 120-200 CJK chars)**. Stay strictly faithful — do NOT invent.
- image_prompt: for gpt-image-2 (40-70 words). See Task 3A.
- image_prompt_seedream: for Seedream (**80-130 words, more detailed**). See Task 3B.

# Task 2: Design unified visual style

style_description (60+ words): color palette, typography, layout tendency, decorative elements, atmosphere.

# Task 3: Generate two image_prompts per slide

## 🚨 Universal rules (both prompts must follow)

### A. 「Quote」 convention (MOST IMPORTANT)
Text that should **actually appear as visible text** on the image MUST be wrapped in 「Chinese corner quotes」.
Any description NOT in 「」 is layout/style instruction — must NOT be rendered as visible text.

✅ Right: "Title 「Key Points」 centered, 3 rounded white cards below, first card has 「Symptom 1」 as title"
❌ Wrong: "Title: Key Points (centered). Card 1: Symptom 1 (with stomach icon)"

### 🌐 LANGUAGE HARD CONSTRAINT
The "language" field is user-selected. When language = "en", ALL 「」 text MUST be English — NO Chinese, Japanese, Korean characters allowed. When language = "zh", ALL 「」 text MUST be Simplified Chinese — NO Japanese kana, Korean, Traditional Chinese long phrases (English technical terms from the source are OK). Each image_prompt must explicitly state the language constraint ("all text in English only" / "所有文字必须是简体中文").

### B. Faithful to slide_script (no hallucination)
### C. Consistent style, varied layouts per page
### D. Fill the 16:9 canvas — no half-empty layouts

## Task 3A: image_prompt (for gpt-image-2, 40-70 words)
Use abstract design vocab freely: infographic, hierarchy, grid, balanced composition, color blocking.

## Task 3B: image_prompt_seedream (for Seedream, 80-130 words, more detail)
Seedream needs concrete Chinese-popular vocabulary, not abstract English terms.
Use: "小红书风格科普长图", "圆角卡片", "手绘感图标", concrete object positions.
Describe by 6 parts: top bar / main title / main content cards / character illustration / bottom bar / decorations.
Keep 「」 text under 10 chars (ideal 4-8). Never put instructions like "(with icon)" inside 「」.

# Strict constraints
1. slide_script faithful to source
2. Both prompts based on slide_script
3. 「」 convention strictly enforced in BOTH prompts
4. Colors in hex
5. Field names lowercase with underscores
6. JSON output only, no markdown fences

# Schema
{
  "language": "en",
  "deck_title": "...",
  "slides": [
    {"id": "s1", "slide_script": "...", "image_prompt": "...", "image_prompt_seedream": "..."}
  ],
  "style_description": "..."
}`;

/**
 * Build the user message, optionally injecting page-count constraint.
 */
export function buildUserMessage(
  script: string,
  language: Language,
  minSlides?: number,
  maxSlides?: number,
): string {
  if (!minSlides && !maxSlides) return script;
  const lo = minSlides ?? maxSlides!;
  const hi = maxSlides ?? minSlides!;
  if (language === 'en') {
    return `[Page count requirement] Split this script into ${lo}-${hi} slides.\n\nSource script:\n${script}`;
  }
  return `【页数要求】请把这份文稿拆解成 ${lo} 到 ${hi} 页 slide（务必落在此范围内）。\n\n原文稿：\n${script}`;
}

export function getSystemPrompt(
  language: Language,
  _imageProvider: ImageProvider = 'gpt-image-2',
): string {
  // 两套 prompt 都会生成，不再需要 provider hint
  return language === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH;
}

/**
 * 选用该 provider 对应的 image_prompt，并加上必要的硬约束包装。
 */
export function buildImagePrompt(params: {
  imagePromptGpt: string;
  imagePromptSeedream?: string | null;
  language: Language;
  provider: ImageProvider;
  hasReference?: boolean;
  hasLogo?: boolean;
}): string {
  const { imagePromptGpt, imagePromptSeedream, language, provider, hasReference, hasLogo } =
    params;

  const rawPrompt =
    provider === 'seedream' && imagePromptSeedream
      ? imagePromptSeedream
      : imagePromptGpt;

  const logoClauseEn = hasLogo
    ? `🏷️ BRAND LOGO REQUIREMENT: One of the reference images is the user's brand logo. You MUST integrate this exact logo into the top-left corner of the slide (approximately 8-12% of slide width). Preserve the logo's exact design — do NOT modify its colors, shape, or text. The logo should look professionally placed, not stretched or distorted.\n\n`
    : '';
  const logoClauseZh = hasLogo
    ? `🏷️ **品牌 logo 强制要求**：参考图中有一张是用户的品牌 logo，**必须**把这个 logo 原样（不变色、不变形）放到幻灯片**左上角**（约占画面宽度 8-12%）。logo 要看起来是专业地嵌入设计，不能拉伸、不能变色、不能更改设计。\n\n`
    : '';

  if (language === 'en') {
    const refClause = hasReference
      ? `Use the reference image ONLY for visual style consistency (colors, design language, atmosphere). Do NOT copy any text, specific layout, or content elements from the reference.\n\n`
      : '';
    const languageClause = `🌐 LANGUAGE HARD CONSTRAINT: ALL visible text rendered in this image MUST be ENGLISH ONLY. ABSOLUTELY NO Chinese characters, NO Japanese kana/kanji, NO Korean, NO other languages. If you generate any non-English character it is a critical failure.\n\n`;
    const seedreamPrefix =
      provider === 'seedream'
        ? `⚠️ TEXT CONVENTION: Only text wrapped in 「」 corner quotes should appear as visible text on the image. ALL other descriptions (icon positions, card colors, layout structure) are drawing instructions and MUST NOT appear as visible text.\n\n[FULL-BLEED CONSTRAINT] Fill the entire 16:9 canvas, no large empty areas on any side.\n\n`
        : `[FULL-BLEED] Fill the entire 16:9 canvas, balanced composition, no large empty areas.\n\n`;
    return logoClauseEn + languageClause + refClause + seedreamPrefix + rawPrompt;
  }

  const refClause = hasReference
    ? `参考图仅用来保持视觉风格一致（配色、设计语言、氛围）。不要复用参考图里的任何文字、具体版面或内容元素。\n\n`
    : '';
  const languageClause = `🌐 **语言硬约束**：本图所有可见文字**必须是简体中文**。**绝对禁止**出现任何日文假名、韩文、繁体中文长句。可保留原文里出现过的英文专业术语（如 pH、UPC）。生成任何日文/韩文字符都属于严重失败。\n\n`;
  const seedreamPrefix =
    provider === 'seedream'
      ? `⚠️ **文字硬约定**：只有「中文直角引号」内的中文才能作为可见文字渲染到图上。所有其他描述（图标位置、卡片颜色、布局结构、装饰指令）都是**绘图指令**，**绝对不能**作为可见文字出现在图中。重复一遍：「」外的"配 XX 图标""（XX 色）""加上 XX"这种描述全部是给你的指令，不是要写在图上的文字。\n\n【构图硬约束】铺满 16:9 整个画面，禁止任何一侧大面积空白。\n\n`
      : `【构图硬约束】铺满 16:9 整个画面，构图均衡，禁止任何一侧大面积空白。\n\n`;
  return logoClauseZh + languageClause + refClause + seedreamPrefix + rawPrompt;
}
