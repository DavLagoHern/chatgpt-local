import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const ROOT = process.cwd();
const CHATS_DIR = path.join(ROOT, 'data', 'chats');
const INDEX_FILE = path.join(CHATS_DIR, 'index.json');

async function ensureStorage() {
    await fs.mkdir(CHATS_DIR, { recursive: true });
    try { await fs.access(INDEX_FILE); }
    catch { await fs.writeFile(INDEX_FILE, JSON.stringify([], null, 2), 'utf8'); }
}

type IndexRow = { id: string; name: string; updatedAt: string };

async function readIndex(): Promise<IndexRow[]> {
    await ensureStorage();
    const raw = await fs.readFile(INDEX_FILE, 'utf8').catch(() => '[]');
    return JSON.parse(raw) as IndexRow[];
}
async function writeIndex(items: IndexRow[]) {
    await ensureStorage();
    await fs.writeFile(INDEX_FILE, JSON.stringify(items, null, 2), 'utf8');
}

export async function GET() {
    const index = await readIndex();
    // ordenar desc por updatedAt
    index.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return NextResponse.json(index.map(i => ({ id: i.id, name: i.name })));
}

export async function POST(req: Request) {
    const { name } = await req.json().catch(() => ({ name: 'Nuevo chat' as string }));
    const id = randomUUID();
    const now = new Date().toISOString();

    await ensureStorage();
    const file = path.join(CHATS_DIR, `${id}.json`);

    const data = { id, name: name || 'Nuevo chat', messages: [] as any[] };
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');

    const index = await readIndex();
    index.push({ id, name: data.name, updatedAt: now });
    await writeIndex(index);

    return NextResponse.json({ id, name: data.name });
}
