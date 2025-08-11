import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const CHATS_DIR = path.join(ROOT, 'data', 'chats');
const INDEX_FILE = path.join(CHATS_DIR, 'index.json');

async function readIndex() {
    try {
        const raw = await fs.readFile(INDEX_FILE, 'utf8');
        return JSON.parse(raw) as { id: string; name: string; updatedAt: string }[];
    } catch {
        return [];
    }
}
async function writeIndex(items: any[]) {
    await fs.writeFile(INDEX_FILE, JSON.stringify(items, null, 2), 'utf8');
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
    const id = params.id;
    const file = path.join(CHATS_DIR, `${id}.json`);
    try {
        const raw = await fs.readFile(file, 'utf8');
        const data = JSON.parse(raw);
        return NextResponse.json({ id: data.id, name: data.name, messages: data.messages || [] });
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
}

// Renombrar
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const id = params.id;
    const { name } = await req.json().catch(() => ({} as any));
    if (!name || typeof name !== 'string') return NextResponse.json({ ok: true });

    const file = path.join(CHATS_DIR, `${id}.json`);
    try {
        const raw = await fs.readFile(file, 'utf8');
        const data = JSON.parse(raw);
        data.name = name;
        await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');

        const index = await readIndex();
        const now = new Date().toISOString();
        const idx = index.findIndex(x => x.id === id);
        if (idx >= 0) index[idx] = { ...index[idx], name, updatedAt: now };
        await writeIndex(index);

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
    const id = params.id;
    const file = path.join(CHATS_DIR, `${id}.json`);
    try {
        await fs.unlink(file);
    } catch {
        // ya no existe
    }
    const index = await readIndex();
    const filtered = index.filter(x => x.id !== id);
    await writeIndex(filtered);
    return NextResponse.json({ ok: true });
}
