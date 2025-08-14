'use client';
import { Box, Typography } from '@mui/material';
import MarkdownRenderer from './MarkdownRenderer';

type BubbleMeta = { ttfbMs?: number; totalMs?: number };

export default function MessageBubble({
    role, content, meta
}: { role: 'user' | 'assistant'; content: string; meta?: BubbleMeta }) {
    const isUser = role === 'user';

    const fmtMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`);

    return (
        <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', my: 0.75 }}>
            <Box
                sx={{
                    px: 1, py: 0.75,            // 👈 más pequeño
                    maxWidth: '68%',            // 👈 más estrecho
                    borderRadius: 2,
                    bgcolor: isUser ? 'primary.main' : 'background.paper',
                    color: isUser ? 'primary.contrastText' : 'text.primary',
                    boxShadow: 1,
                    border: isUser ? 'none' : '1px solid',
                    borderColor: 'divider',
                    fontSize: '0.9rem',         // 👈 texto más pequeño
                    lineHeight: 1.35
                }}
            >
                {/* Contenido */}
                <MarkdownRenderer content={content} />

                {/* Pie con tiempos */}
                {(meta?.ttfbMs !== undefined || meta?.totalMs !== undefined) && (
                    <Box sx={{ mt: 0.5, display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            {meta?.ttfbMs !== undefined && `⏱️ Primer byte: ${fmtMs(meta.ttfbMs)}`}
                            {meta?.totalMs !== undefined && `${meta?.ttfbMs !== undefined ? ' • ' : ''}Total: ${fmtMs(meta.totalMs)}`}
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
