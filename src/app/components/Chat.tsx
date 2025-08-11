'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box, Stack, TextField, Button, Select, MenuItem, Divider, IconButton, Tooltip
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import MessageBubble from './MessageBubble';
import Typing from './Typing';

type Msg = { role: 'user' | 'assistant'; content: string; ts?: string };

const MODELS = ['gpt-oss:20b']; // añade otros modelos cuando los tengas en Ollama

// ---------- utilidades ----------
const LS_SELECTED = 'selectedChat';
const LS_MODEL = 'selectedModel';

function titleFromFirstUserMessage(msgs: Msg[]): string {
    const first = msgs.find(m => m.role === 'user');
    if (!first) return 'Nuevo chat';
    const t = first.content.replace(/\s+/g, ' ').trim();
    return t.length > 40 ? t.slice(0, 40) + '…' : (t || 'Nuevo chat');
}

// --- API helpers ---
async function apiEnsureSelectedChat(): Promise<string> {
    let id = (typeof window !== 'undefined') ? localStorage.getItem(LS_SELECTED) : null;
    if (id) return id;

    // crea chat vacío por defecto
    const r = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nuevo chat' })
    });
    if (!r.ok) throw new Error('No se pudo crear el chat por defecto');
    const created = await r.json() as { id: string };
    id = created.id;
    localStorage.setItem(LS_SELECTED, id);
    // avisa al sidebar para que refresque
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('chats-reloaded'));
    return id!;
}

async function apiGetMessages(id: string): Promise<Msg[]> {
    const r = await fetch(`/api/chats/${id}/messages`, { cache: 'no-store' });
    if (!r.ok) return [];
    return r.json();
}
async function apiSaveMessages(id: string, msgs: Msg[]): Promise<void> {
    await fetch(`/api/chats/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs })
    });
}
async function apiRename(id: string, name: string): Promise<void> {
    await fetch(`/api/chats/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
}

// --------------------------------------------------

export default function Chat() {
    const [chatId, setChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [model, setModel] = useState<string>(MODELS[0]);

    // modelo seleccionado (persistir sólo en local)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(LS_MODEL);
            if (saved) setModel(saved);
        }
    }, []);
    useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem(LS_MODEL, model); }, [model]);

    // Autoscroll
    useEffect(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, busy]);

    // Cargar chat seleccionado (o crear uno) y sus mensajes
    const loadSelected = useCallback(async () => {
        const id = await apiEnsureSelectedChat();
        setChatId(id);
        const msgs = await apiGetMessages(id);
        setMessages(msgs);
    }, []);

    useEffect(() => {
        // primera carga
        loadSelected();

        // escuchar cambios desde Sidebar
        const onSwap = async () => {
            const id = localStorage.getItem(LS_SELECTED);
            if (!id) {
                // si se borró la selección (p.ej. al borrar chat), creamos uno nuevo
                const newId = await apiEnsureSelectedChat();
                setChatId(newId);
                setMessages(await apiGetMessages(newId));
                return;
            }
            setChatId(id);
            const msgs = await apiGetMessages(id);
            setMessages(msgs);
        };
        window.addEventListener('chat-changed', onSwap);
        return () => window.removeEventListener('chat-changed', onSwap);
    }, [loadSelected]);

    // Persistir mensajes en disco + actualizar título si procede
    const persist = useCallback(async (msgs: Msg[]) => {
        if (!chatId) return;
        await apiSaveMessages(chatId, msgs);

        const newTitle = titleFromFirstUserMessage(msgs);
        await apiRename(chatId, newTitle);
        // notificar al sidebar que recargue el historial
        window.dispatchEvent(new Event('chats-reloaded'));
    }, [chatId]);

    // Enviar mensaje
    async function send() {
        const text = input.trim();
        if (!text || busy || !chatId) return;

        const userMsg: Msg = { role: 'user', content: text, ts: new Date().toISOString() };
        const nextMsgs = [...messages, userMsg];

        setInput('');
        setBusy(true);
        setMessages(nextMsgs);
        await persist(nextMsgs); // guardamos inmediatamente para que el título se actualice

        try {
            // streaming
            const body = JSON.stringify({
                model,
                messages: [...nextMsgs.slice(-12)],
                options: { temperature: 0.7, top_p: 0.9 }
            });

            const resp = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });

            if (!resp.ok || !resp.body) {
                const fail = [...nextMsgs, { role: 'assistant' as const, content: '⚠️ Error al conectar con el modelo.' }];
                setMessages(fail);
                await persist(fail);
                setBusy(false);
                return;
            }

            // añadimos un mensaje vacío del assistant y lo vamos rellenando
            let acc = '';
            setMessages(m => [...m, { role: 'assistant', content: '' }]);

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                acc += decoder.decode(value, { stream: true });
                setMessages(m => {
                    const copy = [...m];
                    const last = copy.length - 1;
                    copy[last] = { ...copy[last], content: acc };
                    return copy;
                });
            }

            // estado final en memoria + persistencia
            const finalMsgs: Msg[] = [...nextMsgs, { role: 'assistant', content: acc, ts: new Date().toISOString() }];
            setMessages(finalMsgs);
            await persist(finalMsgs);
        } catch (e) {
            const fail = [...nextMsgs, { role: 'assistant' as const, content: '⚠️ Error inesperado.' }];
            setMessages(fail);
            await persist(fail);
        } finally {
            setBusy(false);
        }
    }

    // Borrar conversación actual (deja el archivo con array vacío y título por defecto)
    async function clearChat() {
        if (!chatId) return;
        setMessages([]);
        await apiSaveMessages(chatId, []);
        await apiRename(chatId, 'Nuevo chat');
        window.dispatchEvent(new Event('chats-reloaded'));
    }

    const canSend = useMemo(() => !!input.trim() && !busy, [input, busy]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Barra superior (modelo + limpiar) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
                <Select
                    size="small"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    sx={{ minWidth: 180 }}
                >
                    {MODELS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
                <Tooltip title="Vaciar conversación">
                    <IconButton size="small" onClick={clearChat}>
                        <ClearIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            <Divider sx={{ mb: 1 }} />

            {/* Zona de mensajes */}
            <Box
                ref={scrollerRef}
                sx={{
                    flex: 1,
                    overflow: 'auto',
                    pr: 1,
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {messages.map((m, i) => (
                    <MessageBubble key={i} role={m.role} content={m.content} />
                ))}

                {busy && (
                    <Box sx={{ my: 1, display: 'flex', justifyContent: 'flex-start' }}>
                        <Typing />
                    </Box>
                )}
            </Box>

            <Divider sx={{ my: 1 }} />

            {/* Input */}
            <Stack direction="row" spacing={1}>
                <TextField
                    fullWidth
                    placeholder="Escribe tu mensaje…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send();
                        }
                    }}
                    multiline
                    maxRows={6}
                />
                <Button onClick={send} disabled={!canSend} variant="contained">Enviar</Button>
            </Stack>
        </Box>
    );
}
