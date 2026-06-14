const LOGO_KEY = 'ppt-tool-logo';
const MAX_LOGO_BYTES = 1_000_000; // 1MB cap (base64 inflation ~33%)

export function loadLogo(): string | null {
  return localStorage.getItem(LOGO_KEY);
}

export function saveLogo(dataUri: string): void {
  localStorage.setItem(LOGO_KEY, dataUri);
}

export function clearLogo(): void {
  localStorage.removeItem(LOGO_KEY);
}

export async function fileToDataUri(file: File): Promise<string> {
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error(
      `Logo 文件太大（${(file.size / 1024).toFixed(0)} KB），请用 1MB 以内的图`,
    );
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(`只接受图片文件，当前是 ${file.type || '未知'}`);
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
