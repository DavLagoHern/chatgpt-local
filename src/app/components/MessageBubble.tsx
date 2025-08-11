'use client';
import { Box } from '@mui/material';
import MarkdownRenderer from './MarkdownRenderer';
export default function MessageBubble({
    role, content
}: { role: 'user' | 'assistant'; content: string }) {
    const isUser = role === 'user';
    return (
        <Box sx={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            my: 1
        }}>
            <Box sx={{
                px: 1.5, py: 1.2, maxWidth: '75%',
                borderRadius: 2,
                bgcolor: isUser ? 'primary.main' : 'background.paper',
                color: isUser ? 'primary.contrastText' : 'text.primary',
                boxShadow: 1,
                border: isUser ? 'none' : '1px solid',
                borderColor: 'divider',
            }}>
                <MarkdownRenderer content={content} />
            </Box>
        </Box>
    );
}
