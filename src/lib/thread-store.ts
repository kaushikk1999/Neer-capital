import { promises as fs } from 'fs';
import path from 'path';

// Simplest persistent store: a JSON file keyed by sender email. Persistent on a
// single/long-running instance; ephemeral on serverless — swap for a KV/DB there.
export type Thread = { subject: string; messageId: string; references: string[] };

const FILE = path.join(process.cwd(), '.data', 'contact-threads.json');

async function readAll(): Promise<Record<string, Thread>> {
  try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { return {}; }
}

export async function getThread(email: string): Promise<Thread | undefined> {
  return (await readAll())[email.toLowerCase()];
}

export async function saveThread(email: string, t: Thread): Promise<void> {
  const all = await readAll();
  all[email.toLowerCase()] = t;
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}
