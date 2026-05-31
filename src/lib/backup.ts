// AES-GCM passphrase-based encryption using Web Crypto.
// File format (JSON):
// { v: 1, app: "nebula-vault", salt: b64, iv: b64, ciphertext: b64, count: number }

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = {
  encode(buf: ArrayBuffer | Uint8Array): string {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  },
  decode(s: string): Uint8Array {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export type BackupEntry = {
  website: string;
  username: string;
  password: string;
};

export async function encryptBackup(
  entries: BackupEntry[],
  passphrase: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = enc.encode(
    JSON.stringify({ exportedAt: new Date().toISOString(), entries })
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );
  return JSON.stringify(
    {
      v: 1,
      app: "nebula-vault",
      salt: b64.encode(salt),
      iv: b64.encode(iv),
      ciphertext: b64.encode(ciphertext),
      count: entries.length,
    },
    null,
    2
  );
}

export async function decryptBackup(
  fileText: string,
  passphrase: string
): Promise<BackupEntry[]> {
  let parsed: {
    v?: number;
    app?: string;
    salt?: string;
    iv?: string;
    ciphertext?: string;
  };
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new Error("Not a valid backup file");
  }
  if (parsed.app !== "nebula-vault" || !parsed.salt || !parsed.iv || !parsed.ciphertext) {
    throw new Error("Unrecognized backup file format");
  }
  const salt = b64.decode(parsed.salt);
  const iv = b64.decode(parsed.iv);
  const ciphertext = b64.decode(parsed.ciphertext);
  const key = await deriveKey(passphrase, salt);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  } catch {
    throw new Error("Wrong passphrase or corrupted file");
  }
  const payload = JSON.parse(dec.decode(plain)) as { entries: BackupEntry[] };
  if (!Array.isArray(payload.entries)) throw new Error("Backup contains no entries");
  return payload.entries.filter(
    (e) =>
      typeof e?.website === "string" &&
      typeof e?.username === "string" &&
      typeof e?.password === "string"
  );
}

export function toCSV(entries: BackupEntry[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [["website", "username", "password"].map(esc).join(",")];
  for (const e of entries) {
    rows.push([esc(e.website), esc(e.username), esc(e.password)].join(","));
  }
  return rows.join("\n");
}

export function downloadFile(filename: string, mime: string, data: string | Blob) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
