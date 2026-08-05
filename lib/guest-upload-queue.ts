const GUEST_UPLOAD_QUEUE_DB = "spetly-guest-upload-queue";
const GUEST_UPLOAD_QUEUE_STORE = "queues";
const GUEST_UPLOAD_QUEUE_VERSION = 1;

export type PersistedGuestUploadFile = {
  clientId: string;
  blob: Blob;
  filename: string;
  lastModified: number;
  contentType: string;
  contentHash: string;
  imageWidth: number;
  imageHeight: number;
};

export type PersistedGuestUploadQueue = {
  galleryId: string;
  name: string;
  email: string;
  files: PersistedGuestUploadFile[];
  updatedAt: number;
};

function openQueueDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = indexedDB.open(GUEST_UPLOAD_QUEUE_DB, GUEST_UPLOAD_QUEUE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(GUEST_UPLOAD_QUEUE_STORE)) {
        database.createObjectStore(GUEST_UPLOAD_QUEUE_STORE, { keyPath: "galleryId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The upload queue could not be opened."));
    request.onblocked = () => reject(new Error("The upload queue database is blocked."));
  });
}

function runQueueRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
) {
  return openQueueDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(GUEST_UPLOAD_QUEUE_STORE, mode);
    const request = operation(transaction.objectStore(GUEST_UPLOAD_QUEUE_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The upload queue request failed."));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("The upload queue transaction was aborted."));
    };
    transaction.onerror = () => database.close();
  }));
}

export async function loadGuestUploadQueue(galleryId: string) {
  const result = await runQueueRequest<PersistedGuestUploadQueue | undefined>(
    "readonly",
    (store) => store.get(galleryId)
  );

  return result ?? null;
}

export async function saveGuestUploadQueue(queue: PersistedGuestUploadQueue) {
  await runQueueRequest<IDBValidKey>("readwrite", (store) => store.put(queue));
}

export async function clearGuestUploadQueue(galleryId: string) {
  await runQueueRequest<undefined>("readwrite", (store) => store.delete(galleryId));
}
