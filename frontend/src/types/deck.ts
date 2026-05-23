export type Language = 'zh' | 'en';

export interface Slide {
  id: string;
  slide_script: string;
  image_prompt: string;
  image_prompt_seedream?: string;
  image_url?: string | null;
}

export interface Deck {
  language: Language;
  slides: Slide[];
  style_description: string;
  anchor_image_url?: string | null;
}

export interface ScriptInput {
  script: string;
  language: Language;
  llm_model: string;
  image_model: string;
}

export interface ApiKeys {
  deepseek_api_key?: string;
  volcano_ark_api_key?: string;
  apimart_api_key?: string;
  doubao_model?: string;
  seedream_t2i_model?: string;
  seedream_i2i_model?: string;
}
