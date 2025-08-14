'use client';

import { useEffect, useState } from 'react';
import {
    Box, List, ListItemButton, ListItemText, IconButton,
    Typography, Divider, Button, TextField, Stack, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';

type ChatMeta = { id: string; title: string };
const LS_SELECTED = 'selectedChat';

// --- API helpers ---
async function apiList(): Promise<{ id: string; name: string }[]> {
    const r = await fetch('/api/chats', { cache: 'no-store' });
    if (!r.ok) return [];
    return r.json();
}
async function apiCreate(name: string) {
    const r = await fetch('/api/chats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    if (!r.ok) throw new Error('Error creando el chat');
    return r.json();
}
async function apiDelete(id: string) {
    await fetch(`/api/chats/${id}`, { method: 'DELETE' });
}
async function apiRename(id: string, name: string) {
    await fetch(`/api/chats/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
}

export default function SideBar() {
    const [chats, setChats] = useState<ChatMeta[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [titleDraft, setTitleDraft] = useState('');

    // Estado para el diálogo "Nuevo chat"
    const [openNew, setOpenNew] = useState(false);
    const [newName, setNewName] = useState('');

    const loadChats = async () => {
        const list = await apiList();
        setChats(list.map(c => ({ id: c.id, title: c.name })));
        const sel = localStorage.getItem(LS_SELECTED);
        if (sel) setSelected(sel);
    };

    useEffect(() => { loadChats(); }, []);

    useEffect(() => {
        const reload = () => loadChats();
        window.addEventListener('chats-reloaded', reload);
        return () => window.removeEventListener('chats-reloaded', reload);
    }, []);

    function selectChat(id: string) {
        setSelected(id);
        localStorage.setItem(LS_SELECTED, id);
        window.dispatchEvent(new Event('chat-changed'));
    }

    // Abre el diálogo para crear chat
    function addChat() {
        setNewName('');
        setOpenNew(true);
    }

    // Crea el chat con el nombre del diálogo
    async function handleCreate() {
        const name = (newName.trim() || 'Nuevo chat');
        try {
            const created = await apiCreate(name);
            const updated = [...chats, { id: created.id, title: created.name }];
            setChats(updated);
            selectChat(created.id);
            setOpenNew(false);
            setNewName('');
        } catch (e) {
            // Opcional: mostrar un snackbar/toast
            console.error(e);
        }
    }

    async function deleteChat(id: string) {
        await apiDelete(id);
        const updated = chats.filter(c => c.id !== id);
        setChats(updated);
        if (selected === id) {
            localStorage.removeItem(LS_SELECTED);
            setSelected(null);
            window.dispatchEvent(new Event('chat-changed'));
        }
    }

    function startEdit(id: string, title: string) {
        setEditing(id);
        setTitleDraft(title);
    }

    async function saveEdit(id: string) {
        const name = titleDraft.trim() || 'Sin título';
        await apiRename(id, name);
        const updated = chats.map(c => c.id === id ? { ...c, title: name } : c);
        setChats(updated);
        setEditing(null);
        setTitleDraft('');
        // refresca posibles vistas
        window.dispatchEvent(new Event('chats-reloaded'));
    }

    return (
        <Box
            sx={{
                width: 260,
                bgcolor: 'background.paper',
                borderRight: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <Box sx={{ p: 2 }}>
                <Typography variant="h6">Historial</Typography>
                <Button variant="outlined" fullWidth sx={{ mt: 1 }} onClick={addChat}>
                    Nuevo chat
                </Button>
            </Box>

            <Divider />

            <List sx={{ flex: 1, overflowY: 'auto' }}>
                {chats.map(chat => {
                    const isSel = chat.id === selected;
                    const isEdit = chat.id === editing;
                    return (
                        <ListItemButton
                            key={chat.id}
                            selected={isSel}
                            onClick={() => selectChat(chat.id)}
                            sx={{ alignItems: 'center' }}
                        >
                            <ListItemText
                                primary={
                                    isEdit ? (
                                        <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
                                            <TextField
                                                size="small"
                                                value={titleDraft}
                                                onChange={e => setTitleDraft(e.target.value)}
                                                autoFocus
                                                fullWidth
                                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(chat.id); }}
                                            />
                                            <IconButton size="small" onClick={() => saveEdit(chat.id)}>
                                                <CheckIcon fontSize="inherit" />
                                            </IconButton>
                                        </Stack>
                                    ) : (
                                        chat.title || 'Sin título'
                                    )
                                }
                            />
                            {!isEdit && (
                                <Stack direction="row" spacing={0.5}>
                                    <Tooltip title="Renombrar">
                                        <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); startEdit(chat.id, chat.title); }}
                                        >
                                            <EditIcon fontSize="inherit" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Borrar">
                                        <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                                        >
                                            <DeleteIcon fontSize="inherit" />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            )}
                        </ListItemButton>
                    );
                })}
            </List>

            {/* Diálogo para crear nuevo chat */}
            <Dialog
                open={openNew}
                onClose={() => setOpenNew(false)}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle>Nuevo chat</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Título del chat"
                        placeholder="Ej. Investigación, Soporte, Ideas..."
                        fullWidth
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenNew(false)}>Cancelar</Button>
                    <Button onClick={handleCreate}>Crear</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
