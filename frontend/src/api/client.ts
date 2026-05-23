import type { ApiKeys, Deck, ScriptInput } from '../types/deck';
import { generateDeckImages, generateSingleSlideImage } from '../lib/imagegen';
import { callLLM } from '../lib/llm';
import { downloadDeckAsPptx } from '../lib/pptx';
import {
  IMAGE_PROVIDERS,
  LLM_PROVIDERS,
  type ImageProvider,
  type LLMProvider,
} from '../lib/registry';

const STORAGE_KEY = 'ppt-tool-api-keys';

export function loadApiKeys(): ApiKeys {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveApiKeys(keys: ApiKeys): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export async function listLLMs(): Promise<string[]> {
  return [...LLM_PROVIDERS];
}

export async function listImageModels(): Promise<string[]> {
  return [...IMAGE_PROVIDERS];
}

export async function generateDeck(input: ScriptInput): Promise<Deck> {
  return callLLM(
    input.llm_model as LLMProvider,
    input.script,
    input.language,
    loadApiKeys(),
  );
}

export async function generateImages(
  deck: Deck,
  imageModel: string,
): Promise<Deck> {
  return generateDeckImages(deck, imageModel as ImageProvider, loadApiKeys());
}

export async function regenerateSlide(
  deck: Deck,
  slideIndex: number,
  imageModel: string,
): Promise<Deck> {
  const slide = deck.slides[slideIndex];
  if (!slide) throw new Error(`slide index ${slideIndex} out of range`);
  const isAnchor = slideIndex === 0;

  const newUrl = await generateSingleSlideImage({
    slide,
    styleDescription: deck.style_description,
    language: deck.language,
    anchorImageUrl: deck.anchor_image_url,
    isAnchor,
    provider: imageModel as ImageProvider,
    apiKeys: loadApiKeys(),
  });

  const newSlides = [...deck.slides];
  newSlides[slideIndex] = { ...newSlides[slideIndex], image_url: newUrl };

  return {
    ...deck,
    slides: newSlides,
    anchor_image_url: isAnchor ? newUrl : deck.anchor_image_url,
  };
}

export async function exportDeck(deck: Deck, filename = 'deck.pptx'): Promise<void> {
  return downloadDeckAsPptx(deck, filename);
}
