import { useEffect, useState } from 'react';
import './App.css';
import type { ApiKeys, Deck, Language } from './types/deck';
import {
  exportDeck,
  generateDeck,
  generateImages,
  listImageModels,
  listLLMs,
  loadApiKeys,
  regenerateSlide,
  saveApiKeys,
} from './api/client';
import { extractTextFromFile } from './lib/docparse';
import { clearLogo, fileToDataUri, loadLogo, saveLogo } from './lib/logo';

const EXAMPLES: { tag: string; title: string; script: string }[] = [
  {
    tag: '商业宣讲',
    title: '产品发布会',
    script:
      '今天我们正式发布 Atlas 3.0——AI 工作流自动化平台的最新版本。Atlas 3.0 带来三项重要升级：第一，新增 100+ 行业模板，开箱即用；第二，多模态 AI 协作能力，文本、图像、表格统一处理；第三，企业级数据安全，全程加密、可审计。我们已经服务超过 1000 家企业客户，覆盖金融、医疗、零售三大行业。新版本将于下个月开始公测，欢迎注册抢先体验。',
  },
  {
    tag: '教学培训',
    title: '数据分析入门',
    script:
      '今天我们讨论数据分析的三个层次。第一层是描述性分析，回答"发生了什么"——这是最基础的工作，看趋势、看分布。第二层是诊断性分析，回答"为什么发生"，需要找根本原因，做归因。第三层是预测性分析，回答"接下来会发生什么"，这就需要建模和机器学习了。新手通常停留在第一层，资深分析师才能游刃有余地在三层之间切换。理解这三层的差异，是从分析师到数据科学家的关键一步。',
  },
  {
    tag: '路演汇报',
    title: '季度业务回顾',
    script:
      '第二季度业务回顾。营收方面，本季度实现 1.2 亿元，同比增长 35%，超出年初目标 15%。三条业务线中，企业服务最为亮眼，贡献了 60% 的营收增长。客户方面，新增企业客户 120 家，留存率提升至 92%。成本控制良好，毛利率从去年同期的 58% 提升至 65%。下半年的重点是产品创新和市场拓展，目标是把全年营收提升到 5 亿元。',
  },
];

type Stage = 1 | 2 | 3 | 4;

function getStage(deck: Deck | null): Stage {
  if (!deck) return 1;
  if (!deck.anchor_image_url) return 2;
  return 4;
}

function pageRangeToSlides(
  range: 'auto' | 'short' | 'medium' | 'long' | 'xlong',
): { min_slides?: number; max_slides?: number } {
  switch (range) {
    case 'short':
      return { min_slides: 3, max_slides: 5 };
    case 'medium':
      return { min_slides: 6, max_slides: 9 };
    case 'long':
      return { min_slides: 10, max_slides: 14 };
    case 'xlong':
      return { min_slides: 15, max_slides: 20 };
    case 'auto':
    default:
      return {};
  }
}

function App() {
  const [script, setScript] = useState('');
  const [language, setLanguage] = useState<Language>('zh');
  const [llmModel, setLlmModel] = useState('deepseek');
  const [imageModel, setImageModel] = useState('gpt-image-2');
  const [pageRange, setPageRange] = useState<'auto' | 'short' | 'medium' | 'long' | 'xlong'>(
    'auto',
  );
  const [parsing, setParsing] = useState(false);
  const [llmOptions, setLlmOptions] = useState<string[]>([]);
  const [imageOptions, setImageOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeysConfigured, setApiKeysConfigured] = useState<ApiKeys>({});

  useEffect(() => {
    listLLMs()
      .then(setLlmOptions)
      .catch((e) => console.warn('listLLMs', e));
    listImageModels()
      .then(setImageOptions)
      .catch((e) => console.warn('listImageModels', e));
    setApiKeysConfigured(loadApiKeys());
  }, []);

  async function handleFileUpload(file: File) {
    setParsing(true);
    setError(null);
    try {
      const text = await extractTextFromFile(file);
      if (!text) throw new Error('文档解析出的文本为空');
      setScript(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setDeck(null);
    try {
      const result = await generateDeck({
        script,
        language,
        llm_model: llmModel,
        image_model: imageModel,
        ...pageRangeToSlides(pageRange),
      });
      setDeck(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateImages() {
    if (!deck) return;
    if (
      deck.anchor_image_url &&
      !window.confirm(
        '确定要重新生成所有图像吗？这会覆盖现有图像，并重新消耗 API 额度。',
      )
    ) {
      return;
    }
    setGeneratingImages(true);
    setError(null);
    try {
      const updated = await generateImages(deck, imageModel);
      setDeck(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGeneratingImages(false);
    }
  }

  async function handleExport() {
    if (!deck) return;
    setExporting(true);
    setError(null);
    try {
      await exportDeck(deck);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  function updateSlideScript(idx: number, value: string) {
    if (!deck) return;
    const newSlides = [...deck.slides];
    newSlides[idx] = { ...newSlides[idx], slide_script: value };
    setDeck({ ...deck, slides: newSlides });
  }

  function updateSlideImagePrompt(idx: number, value: string) {
    if (!deck) return;
    const newSlides = [...deck.slides];
    newSlides[idx] = { ...newSlides[idx], image_prompt: value };
    setDeck({ ...deck, slides: newSlides });
  }

  function updateSlideImagePromptSeedream(idx: number, value: string) {
    if (!deck) return;
    const newSlides = [...deck.slides];
    newSlides[idx] = { ...newSlides[idx], image_prompt_seedream: value };
    setDeck({ ...deck, slides: newSlides });
  }

  function updateStyleDescription(value: string) {
    if (!deck) return;
    setDeck({ ...deck, style_description: value });
  }

  async function handleRegenerateSlide(idx: number) {
    if (!deck) return;
    setRegenIdx(idx);
    setError(null);
    try {
      const updated = await regenerateSlide(deck, idx, imageModel);
      setDeck(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegenIdx(null);
    }
  }

  function handleKeysSaved(keys: ApiKeys) {
    saveApiKeys(keys);
    setApiKeysConfigured(keys);
    setSettingsOpen(false);
  }

  const stage = getStage(deck);
  const hasImages = !!deck?.anchor_image_url;
  const totalChars = deck
    ? deck.slides.reduce((s, x) => s + x.slide_script.length, 0)
    : 0;
  const configuredCount = Object.values(apiKeysConfigured).filter(
    (v) => typeof v === 'string' && v.trim().length > 0,
  ).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" />
          <span className="brand-text">AI PPT 制作工具</span>
        </div>

        <nav className="stepper">
          <Step n={1} label="输入文稿" active={stage === 1} done={stage > 1} />
          <Step n={2} label="编辑逐字稿" active={stage === 2} done={stage > 2} />
          <Step
            n={3}
            label="生成图像"
            active={stage === 2 && generatingImages}
            done={hasImages}
          />
          <Step n={4} label="导出 PPT" active={stage === 4} />
        </nav>

        <div className="topbar-actions">
          {deck && (
            <>
              <button
                className="secondary"
                onClick={handleGenerateImages}
                disabled={generatingImages || regenIdx !== null}
              >
                {generatingImages
                  ? '生成图像中……'
                  : hasImages
                  ? '重新生成所有图像'
                  : '生成图像'}
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || generatingImages || regenIdx !== null}
              >
                {exporting ? '导出中……' : '下载 .pptx'}
              </button>
            </>
          )}
          <button
            className="icon-btn"
            title={`API Keys 设置（已配置 ${configuredCount} 项）`}
            onClick={() => setSettingsOpen(true)}
          >
            <span className="icon-gear">⚙</span>
            {configuredCount > 0 && <span className="icon-dot" />}
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <section>
            <h3 className="sec-title">设置</h3>
            <div className="controls-stack">
              <label>
                <span>语言</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label>
                <span>LLM</span>
                <select
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                >
                  {(llmOptions.length ? llmOptions : ['deepseek']).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>图像模型</span>
                <select
                  value={imageModel}
                  onChange={(e) => setImageModel(e.target.value)}
                >
                  {(imageOptions.length ? imageOptions : ['gpt-image-2']).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>页数</span>
                <select
                  value={pageRange}
                  onChange={(e) =>
                    setPageRange(e.target.value as typeof pageRange)
                  }
                >
                  <option value="auto">自动（LLM 决定）</option>
                  <option value="short">短（3-5 页）</option>
                  <option value="medium">中等（6-9 页）</option>
                  <option value="long">长（10-14 页）</option>
                  <option value="xlong">超长（15-20 页）</option>
                </select>
              </label>
            </div>
            {configuredCount === 0 && (
              <button
                className="ghost"
                style={{ marginTop: '0.85rem' }}
                onClick={() => setSettingsOpen(true)}
              >
                配置 API Keys →
              </button>
            )}
          </section>

          {deck && (
            <section>
              <h3 className="sec-title">视觉风格描述</h3>
              <textarea
                className="sidebar-textarea"
                value={deck.style_description}
                onChange={(e) => updateStyleDescription(e.target.value)}
                rows={7}
              />
              <p className="sidebar-hint">
                所有页共用这套风格描述。修改后再生成图像可换画风。
              </p>
            </section>
          )}

          {deck && (
            <section className="collapsible-section">
              <details>
                <summary>
                  <h3 className="sec-title">原始文稿</h3>
                  <span className="chevron">›</span>
                </summary>
                <textarea
                  className="sidebar-textarea"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={8}
                />
                <button
                  className="ghost"
                  onClick={handleGenerate}
                  disabled={loading || !script.trim()}
                >
                  {loading ? '生成中……' : '重新生成逐字稿'}
                </button>
              </details>
            </section>
          )}
        </aside>

        <main className="main">
          {!deck && (
            <div className="input-stage">
              <div className="hero">
                <h2>把文稿变成 PPT</h2>
                <p className="lead">
                  每一页都是 AI 生成的 16:9 整图，2-3 分钟完成，单 deck 约 ¥0.3。
                </p>
              </div>

              <textarea
                className="main-textarea"
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder={
                  language === 'zh'
                    ? '把你的演讲稿、文章或要点粘贴到这里……'
                    : 'Paste your script, article, or key points here…'
                }
                rows={14}
              />

              <div className="cta-row">
                <button
                  className="cta"
                  onClick={handleGenerate}
                  disabled={loading || parsing || !script.trim()}
                >
                  {loading ? '生成中……' : '生成逐字稿 →'}
                </button>
                <label className="upload-btn">
                  <input
                    type="file"
                    accept=".docx,.pdf,.pptx,.txt,.md"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                      e.target.value = '';
                    }}
                    disabled={parsing || loading}
                  />
                  📎 {parsing ? '解析中……' : '上传文档'}
                </label>
                <span className="cta-hint">
                  {script.length > 0 ? `${script.length} 字` : '或上传 Word/PDF/PPT'}
                </span>
              </div>

              {error && <div className="error">错误：{error}</div>}

              <div className="examples">
                <h3 className="sec-title">没有现成文稿？试试这些示例</h3>
                <div className="example-cards">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.title}
                      className="example-card"
                      onClick={() => setScript(ex.script)}
                    >
                      <span className="example-tag">{ex.tag}</span>
                      <span className="example-title">{ex.title}</span>
                      <span className="example-preview">{ex.script.slice(0, 40)}……</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {deck && (
            <div className="edit-stage">
              <div className="main-header">
                <div>
                  <h2>逐字稿编辑器</h2>
                  <p className="main-meta">
                    共 {deck.slides.length} 页 · {totalChars} 字
                    {hasImages ? ' · 已含图像' : ''}
                  </p>
                </div>
              </div>

              {error && <div className="error">错误：{error}</div>}

              <div className="slides">
                {deck.slides.map((s, i) => (
                  <div key={s.id} className="slide-card">
                    <div className="slide-card-head">
                      <h4>第 {i + 1} 页</h4>
                      <span className="char-count">{s.slide_script.length} 字</span>
                    </div>
                    {s.image_url && (
                      <img
                        className="slide-preview"
                        src={s.image_url}
                        alt={`slide ${i + 1}`}
                      />
                    )}
                    <div className="slide-actions">
                      <button
                        className="ghost slide-regen"
                        onClick={() => handleRegenerateSlide(i)}
                        disabled={
                          regenIdx !== null || generatingImages || loading
                        }
                      >
                        {regenIdx === i
                          ? '生成中……'
                          : s.image_url
                          ? '重新生成图像'
                          : '生成此页图像'}
                      </button>
                    </div>
                    <label className="slide-field-label">详细文字稿</label>
                    <textarea
                      className="slide-script"
                      value={s.slide_script}
                      onChange={(e) => updateSlideScript(i, e.target.value)}
                      rows={6}
                    />
                    <details className="slide-prompt-details">
                      <summary>
                        图像 prompt（高级，可手动调整出图）
                      </summary>
                      <label className="slide-field-label">
                        gpt-image-2 prompt
                      </label>
                      <textarea
                        className="slide-image-prompt"
                        value={s.image_prompt || ''}
                        onChange={(e) =>
                          updateSlideImagePrompt(i, e.target.value)
                        }
                        rows={5}
                        placeholder="（LLM 已为本页生成）"
                      />
                      <label className="slide-field-label">
                        Seedream prompt（更详细，用「」标记真正要显示的文字）
                      </label>
                      <textarea
                        className="slide-image-prompt"
                        value={s.image_prompt_seedream || ''}
                        onChange={(e) =>
                          updateSlideImagePromptSeedream(i, e.target.value)
                        }
                        rows={7}
                        placeholder="（LLM 已为本页生成 Seedream 专用 prompt）"
                      />
                    </details>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {settingsOpen && (
        <SettingsModal
          initial={apiKeysConfigured}
          onSave={handleKeysSaved}
          onCancel={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function Step({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div className={`step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
      <span className="step-num">{done ? '✓' : n}</span>
      <span className="step-label">{label}</span>
    </div>
  );
}

function SettingsModal({
  initial,
  onSave,
  onCancel,
}: {
  initial: ApiKeys;
  onSave: (keys: ApiKeys) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ApiKeys>(initial);

  function update<K extends keyof ApiKeys>(key: K, value: string) {
    setDraft({ ...draft, [key]: value });
  }

  function handleSave() {
    // Trim whitespace; treat empty strings as undefined so backend falls back to env
    const cleaned: ApiKeys = {};
    (Object.keys(draft) as (keyof ApiKeys)[]).forEach((k) => {
      const v = (draft[k] || '').trim();
      if (v) (cleaned as Record<string, string>)[k] = v;
    });
    onSave(cleaned);
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>API Keys 配置</h3>
          <button className="icon-btn" onClick={onCancel} title="关闭">
            <span style={{ fontSize: '1.1rem' }}>✕</span>
          </button>
        </header>

        <p className="modal-hint">
          所有 key 保存在你的浏览器 <code>localStorage</code>，
          只在请求时发送到本工具的后端（不会上传到第三方）。
        </p>

        <div className="modal-section">
          <h4>DeepSeek</h4>
          <p className="modal-section-hint">
            申请：
            <a href="https://platform.deepseek.com" target="_blank" rel="noreferrer">
              platform.deepseek.com
            </a>
          </p>
          <label>
            <span>API Key</span>
            <input
              type="password"
              placeholder="sk-..."
              value={draft.deepseek_api_key || ''}
              onChange={(e) => update('deepseek_api_key', e.target.value)}
            />
          </label>
        </div>

        <div className="modal-section">
          <h4>火山方舟 (Doubao LLM + Seedream 图像)</h4>
          <p className="modal-section-hint">
            申请：
            <a
              href="https://console.volcengine.com/ark"
              target="_blank"
              rel="noreferrer"
            >
              console.volcengine.com/ark
            </a>
          </p>
          <label>
            <span>API Key（共用）</span>
            <input
              type="password"
              placeholder="ak-..."
              value={draft.volcano_ark_api_key || ''}
              onChange={(e) => update('volcano_ark_api_key', e.target.value)}
            />
          </label>
          <label>
            <span>Doubao 模型名（可选，默认 doubao-1-5-pro-32k-250115）</span>
            <input
              type="text"
              placeholder="doubao-1-5-pro-32k-250115 或 ep-xxx"
              value={draft.doubao_model || ''}
              onChange={(e) => update('doubao_model', e.target.value)}
            />
          </label>
          <label>
            <span>Seedream 文生图模型（可选）</span>
            <input
              type="text"
              placeholder="doubao-seedream-3-0-t2i-250415"
              value={draft.seedream_t2i_model || ''}
              onChange={(e) => update('seedream_t2i_model', e.target.value)}
            />
          </label>
          <label>
            <span>Seedream 图生图模型（可选）</span>
            <input
              type="text"
              placeholder="doubao-seededit-3-0-i2i-250628"
              value={draft.seedream_i2i_model || ''}
              onChange={(e) => update('seedream_i2i_model', e.target.value)}
            />
          </label>
        </div>

        <div className="modal-section">
          <h4>apimart.ai (gpt-image-2 图像)</h4>
          <p className="modal-section-hint">
            申请：
            <a href="https://apimart.ai/keys" target="_blank" rel="noreferrer">
              apimart.ai/keys
            </a>
          </p>
          <label>
            <span>API Key</span>
            <input
              type="password"
              placeholder="sk-..."
              value={draft.apimart_api_key || ''}
              onChange={(e) => update('apimart_api_key', e.target.value)}
            />
          </label>
        </div>

        <LogoSection />

        <div className="modal-actions">
          <button className="ghost" onClick={onCancel}>
            取消
          </button>
          <button onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}

function LogoSection() {
  const [logo, setLogo] = useState<string | null>(loadLogo());
  const [err, setErr] = useState<string | null>(null);

  async function onFile(file: File) {
    setErr(null);
    try {
      const uri = await fileToDataUri(file);
      saveLogo(uri);
      setLogo(uri);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="modal-section">
      <h4>品牌 Logo（生成图时融入设计）</h4>
      <p className="modal-section-hint">
        上传一张 PNG/JPG（建议透明背景，≤ 1MB）。每次生成图像时会作为参考图传给图像模型，要求放在左上角。
        融入设计 = 模型会"画出类似的 logo"，不保证 100% 像素级一致。
      </p>
      {logo && (
        <div className="logo-preview">
          <img src={logo} alt="logo preview" />
          <button
            className="ghost"
            type="button"
            onClick={() => {
              clearLogo();
              setLogo(null);
            }}
          >
            移除
          </button>
        </div>
      )}
      <label className="upload-btn" style={{ marginTop: '0.5rem' }}>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
        🏷️ {logo ? '替换 Logo' : '上传 Logo'}
      </label>
      {err && (
        <div className="error" style={{ marginTop: '0.6rem' }}>
          {err}
        </div>
      )}
    </div>
  );
}

export default App;
