'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box, Stack, TextField, Button, Select, MenuItem, Divider, IconButton, Tooltip
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import MessageBubble from './MessageBubble';
import Typing from './Typing';

// Tipos -----------------------------------------------------------------------
type MsgMeta = { ttfbMs?: number; totalMs?: number };
type Msg = { role: 'user' | 'assistant'; content: string; ts?: string; meta?: MsgMeta };

// Constantes ------------------------------------------------------------------
const MODELS = ['gpt-oss:20b']; // añade otros modelos cuando los tengas en Ollama
const LS_SELECTED = 'selectedChat';
const LS_MODEL = 'selectedModel';

// API helpers -----------------------------------------------------------------
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
async function apiCreate(name: string): Promise<{ id: string; name: string }> {
    const r = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    if (!r.ok) throw new Error('No se pudo crear el chat');
    return r.json();
}

// Componente ------------------------------------------------------------------
export default function Chat() {
    const [chatId, setChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [model, setModel] = useState<string>(MODELS[0]);

    // evita crear múltiples veces al escribir por primera vez
    const creatingRef = useRef(false);

    // Modelo seleccionado (persistencia local)
    useEffect(() => {
        const saved = typeof window !== 'undefined' ? localStorage.getItem(LS_MODEL) : null;
        if (saved) setModel(saved);
    }, []);
    useEffect(() => {
        if (typeof window !== 'undefined') localStorage.setItem(LS_MODEL, model);
    }, [model]);

    // Autoscroll
    useEffect(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, busy]);

    // Cargar chat seleccionado si existe (NO crear automáticamente)
    const loadSelected = useCallback(async () => {
        const id = typeof window !== 'undefined' ? localStorage.getItem(LS_SELECTED) : null;
        if (!id) {
            setChatId(null);
            setMessages([]);
            return;
        }
        setChatId(id);
        setMessages(await apiGetMessages(id));
    }, []);

    useEffect(() => {
        loadSelected();

        // escuchar cambios desde Sidebar
        const onSwap = async () => {
            const id = localStorage.getItem(LS_SELECTED);
            if (!id) {
                setChatId(null);
                setMessages([]);
                return;
            }
            setChatId(id);
            setMessages(await apiGetMessages(id));
        };
        window.addEventListener('chat-changed', onSwap);
        return () => window.removeEventListener('chat-changed', onSwap);
    }, [loadSelected]);

    // Persistir mensajes en disco (NO tocar el título aquí)
    const persist = useCallback(async (id: string, msgs: Msg[]) => {
        await apiSaveMessages(id, msgs);
        window.dispatchEvent(new Event('chats-reloaded')); // para refrescar previews/contadores
    }, []);

    // Crear chat al empezar a ESCRIBIR (opcional, para que el sidebar muestre "Nuevo chat" al instante)
    const ensureChatOnTyping = useCallback(async () => {
        if (chatId || busy || creatingRef.current) return;
        creatingRef.current = true;
        try {
            const created = await apiCreate('Nuevo chat');
            setChatId(created.id);
            if (typeof window !== 'undefined') {
                localStorage.setItem(LS_SELECTED, created.id);
                window.dispatchEvent(new Event('chats-reloaded'));
            }
        } finally {
            creatingRef.current = false;
        }
    }, [chatId, busy]);

    // Enviar mensaje (crea chat si aún no existe)
    async function send() {
        const text = input.trim();
        if (!text || busy) return;

        setInput('');
        setBusy(true);

        // Asegura chat si aún no existe (por si el usuario pegó y envió sin "onChange")
        let currentId = chatId;
        if (!currentId) {
            try {
                const created = await apiCreate('Nuevo chat');
                currentId = created.id;
                setChatId(created.id);
                if (typeof window !== 'undefined') {
                    localStorage.setItem(LS_SELECTED, created.id);
                    window.dispatchEvent(new Event('chats-reloaded'));
                }
            } catch {
                setBusy(false);
                setMessages(m => [...m, { role: 'assistant', content: '⚠️ No se pudo crear el chat.' }]);
                return;
            }
        }

        const userMsg: Msg = { role: 'user', content: text, ts: new Date().toISOString() };
        const nextMsgs = [...messages, userMsg];
        setMessages(nextMsgs);
        await persist(currentId!, nextMsgs);

        try {
            // Inicio para medir TTFB/total
            const t0 = performance.now();

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
                const fail = [...nextMsgs, { role: 'assistant' as const, content: '⚠️ Error al conectar con el modelo.', ts: new Date().toISOString() }];
                setMessages(fail);
                await persist(currentId!, fail);
                setBusy(false);
                return;
            }

            // Placeholder del assistant que iremos actualizando
            let acc = '';
            let gotFirst = false;
            let ttfbMs: number | undefined;

            setMessages(m => [...m, { role: 'assistant', content: '', meta: {} }]);

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                if (!gotFirst) {
                    gotFirst = true;
                    ttfbMs = performance.now() - t0;
                    // anota TTFB en el último mensaje (placeholder)
                    setMessages(m => {
                        const copy = [...m];
                        const last = copy.length - 1;
                        copy[last] = { ...copy[last], meta: { ...(copy[last] as any).meta, ttfbMs } };
                        return copy;
                    });
                }

                acc += decoder.decode(value, { stream: true });
                setMessages(m => {
                    const copy = [...m];
                    const last = copy.length - 1;
                    copy[last] = { ...copy[last], content: acc };
                    return copy;
                });
            }

            const totalMs = performance.now() - t0;

            // Estado final: reemplazamos la lista con el mensaje assistant definitivo + meta
            const finalAssistant: Msg = {
                role: 'assistant',
                content: acc,
                ts: new Date().toISOString(),
                meta: { ttfbMs, totalMs }
            };
            const finalMsgs: Msg[] = [...nextMsgs, finalAssistant];

            setMessages(finalMsgs);
            await persist(currentId!, finalMsgs);
        } catch {
            const fail = [...nextMsgs, { role: 'assistant' as const, content: '⚠️ Error inesperado.', ts: new Date().toISOString() }];
            setMessages(fail);
            await persist(currentId!, fail);
        } finally {
            setBusy(false);
        }
    }

    // Vaciar conversación actual (deja array vacío y título por defecto)
    async function clearChat() {
        if (!chatId) return;
        setMessages([]);
        await apiSaveMessages(chatId, []);
        await apiRename(chatId, 'Nuevo chat'); // título por defecto explícito (no se auto-deriva del primer mensaje)
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
                    <MessageBubble key={i} role={m.role} content={m.content} meta={m.meta} />
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
                    onChange={async e => {
                        const val = e.target.value;
                        setInput(val);
                        // crea el chat en cuanto empiezas a escribir si no hay uno seleccionado
                        if (val.trim().length > 0 && !chatId) {
                            await ensureChatOnTyping();
                        }
                    }}
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
