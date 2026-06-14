/**
 * 仪器素材库：用 IndexedDB 存多张图片素材 + 描述。
 * LLM 在生成 image_prompt 时根据本页内容判断哪些素材相关，
 * 输出 material_refs[] 给 image gen 当 reference。
 */

const DB_NAME = 'ppt-tool';
const STORE = 'materials';
const MAX_IMAGE_BYTES = 2_000_000; // 2MB 上限

export interface Material {
  id: string;
  description: string;
  data_uri: string;
  created_at: number;
}

export interface MaterialMeta {
  id: string;
  description: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listMaterials(): Promise<Material[]> {
  const all = await withStore('readonly', (s) => s.getAll() as IDBRequest<Material[]>);
  return (all || []).sort((a, b) => a.created_at - b.created_at);
}

export async function saveMaterial(m: Material): Promise<void> {
  await withStore('readwrite', (s) => s.put(m) as IDBRequest<IDBValidKey>);
}

export async function deleteMaterial(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
}

export async function fileToMaterial(
  file: File,
  description: string,
): Promise<Material> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `素材 "${file.name}" 太大（${(file.size / 1024).toFixed(0)} KB），请用 2MB 以内的图`,
    );
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(`只接受图片文件，当前是 ${file.type || '未知'}`);
  }
  if (!description.trim()) {
    throw new Error('请填写素材描述（LLM 会用它来判断每页该用哪些素材）');
  }
  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const id = `m_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  return {
    id,
    description: description.trim(),
    data_uri: dataUri,
    created_at: Date.now(),
  };
}

/** 给 LLM 用的 meta 列表（不含 base64） */
export function toMeta(materials: Material[]): MaterialMeta[] {
  return materials.map((m) => ({ id: m.id, description: m.description }));
}

/** 给 image gen 用的 lookup */
export function toMap(materials: Material[]): Map<string, Material> {
  return new Map(materials.map((m) => [m.id, m]));
}
