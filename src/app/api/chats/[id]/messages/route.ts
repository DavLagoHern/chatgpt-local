import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

type Msg = { role: 'user' | 'assistant'; content: string; ts?: string };

const ROOT = process.cwd();
const CHATS_DIR = path.join(ROOT, 'data', 'chats');
const INDEX_FILE = path.join(CHATS_DIR, 'index.json');

async function ensureChatFile(id: string) {
    await fs.mkdir(CHATS_DIR, { recursive: true });
    const file = path.join(CHATS_DIR, `${id}.json`);
    try { await fs.access(file); }
    catch { await fs.writeFile(file, JSON.stringify({ id, name: 'Nuevo chat', messages: [] }, null, 2), 'utf8'); }
    return file;
}

async function touchIndex(id: string) {
    try {
        const raw = await fs.readFile(INDEX_FILE, 'utf8');
        const idx = JSON.parse(raw) as { id: string; name: string; updatedAt: string }[];
        const i = idx.findIndex(x => x.id === id);
        const now = new Date().toISOString();
        if (i >= 0) idx[i] = { ...idx[i], updatedAt: now };
        await fs.writeFile(INDEX_FILE, JSON.stringify(idx, null, 2), 'utf8');
    } catch {
        // sin índice aún
    }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
    const id = params.id;
    const file = path.join(CHATS_DIR, `${id}.json`);
    try {
        const raw = await fs.readFile(file, 'utf8');
        const data = JSON.parse(raw);
        return NextResponse.json((data.messages || []) as Msg[]);
    } catch {
        return NextResponse.json([] as Msg[]);
    }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const id = params.id;
    const { messages } = await req.json().catch(() => ({ messages: [] as Msg[] }));
    const file = await ensureChatFile(id);
    try {
        const raw = await fs.readFile(file, 'utf8');
        const data = JSON.parse(raw);
        data.messages = Array.isArray(messages) ? messages : [];
        await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
        await touchIndex(id);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Cannot write' }, { status: 500 });
    }
}
