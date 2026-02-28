import type { EncryptedSecretEnvelope } from "../types";

const DB_NAME = "getintro-secure-db";
const DB_VERSION = 1;
const STORE_NAME = "keys";
const MASTER_KEY_ID = "master-aes-gcm-key";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let keyPromise: Promise<CryptoKey> | null = null;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
};

const openDatabase = async (): Promise<IDBDatabase> => {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const readMasterKey = async (): Promise<CryptoKey | null> => {
  const db = await openDatabase();

  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(MASTER_KEY_ID);

    request.onsuccess = () => {
      resolve((request.result as CryptoKey | undefined) ?? null);
    };

    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
};

const writeMasterKey = async (key: CryptoKey): Promise<void> => {
  const db = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(key, MASTER_KEY_ID);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => reject(tx.error);
  });
};

const getOrCreateMasterKey = async (): Promise<CryptoKey> => {
  if (!keyPromise) {
    keyPromise = (async () => {
      const existing = await readMasterKey();

      if (existing) {
        return existing;
      }

      const created = await crypto.subtle.generateKey(
        {
          name: "AES-GCM",
          length: 256
        },
        false,
        ["encrypt", "decrypt"]
      );

      await writeMasterKey(created);
      return created;
    })();
  }

  return keyPromise;
};

export const encryptSecret = async (
  value: string
): Promise<EncryptedSecretEnvelope> => {
  const key = await getOrCreateMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = encoder.encode(value);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    encoded
  );

  return {
    ciphertextB64: bytesToBase64(new Uint8Array(ciphertext)),
    ivB64: bytesToBase64(iv),
    version: 1
  };
};

export const decryptSecret = async (
  envelope: EncryptedSecretEnvelope
): Promise<string> => {
  const key = await getOrCreateMasterKey();
  const iv = base64ToBytes(envelope.ivB64);
  const encrypted = base64ToBytes(envelope.ciphertextB64);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(iv)
    },
    key,
    asArrayBuffer(encrypted)
  );

  return decoder.decode(plaintext);
};
