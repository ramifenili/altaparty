// Guarda la foto y el audio propios en IndexedDB (no en localStorage) para que
// sobrevivan a una recarga o a la ida y vuelta por Mercado Pago. Quedan solo en
// el navegador del usuario y se borran al quitar el archivo.

const DB = 'invitacion-archivos';
const STORE = 'files';

type Slot = 'photo' | 'audio';
type Saved = {blob: Blob; name: string; type: string};

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
	try {
		const db = await open();
		return await new Promise<T | undefined>((resolve) => {
			const req = fn(db.transaction(STORE, mode).objectStore(STORE));
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => resolve(undefined);
		});
	} catch {
		return undefined; // IndexedDB bloqueado (modo privado, etc.)
	}
}

export const saveFile = (slot: Slot, file: File) =>
	tx('readwrite', (s) => s.put({blob: file, name: file.name, type: file.type} satisfies Saved, slot));

export const removeFile = (slot: Slot) => tx('readwrite', (s) => s.delete(slot));

export async function loadSavedFile(slot: Slot): Promise<File | null> {
	const saved = (await tx<Saved>('readonly', (s) => s.get(slot) as IDBRequest<Saved>)) ?? null;
	return saved ? new File([saved.blob], saved.name, {type: saved.type}) : null;
}
