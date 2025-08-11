'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
    Box, Tab, Tabs, Typography, IconButton, Tooltip, Dialog, DialogContent
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import 'highlight.js/styles/github-dark.css';

type Props = { content: string };

function toPlain(children: React.ReactNode): string {
    return React.Children.toArray(children)
        .map((ch) => {
            if (typeof ch === 'string') return ch;
            // @ts-ignore
            if (ch && typeof ch === 'object' && 'props' in ch) return String(ch.props?.children ?? '');
            return '';
        })
        .join('');
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = React.useState(false);
    async function onCopy() {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    }
    return (
        <Tooltip title={copied ? '¡Copiado!' : 'Copiar'}>
            <IconButton
                size="small"
                onClick={onCopy}
                sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'action.hover' }}
            >
                <ContentCopyIcon fontSize="inherit" />
            </IconButton>
        </Tooltip>
    );
}

const components: Components = {
    p({ children }) {
        return (
            <Typography component="div" paragraph sx={{ my: 1 }}>
                {children}
            </Typography>
        );
    },
    code(props) {
        const { className, children, ...rest } = props as any;
        const lang = (className || '').replace('language-', '').toLowerCase();
        const raw = toPlain(children);
        const seemsBlock = /\n/.test(raw) || !!lang;

        if (!seemsBlock) {
            return <code className={className} {...rest}>{children}</code>;
        }

        // Bloque especial HTML con botón "Ver"
        if (lang === 'html') {
            const [open, setOpen] = React.useState(false);
            return (
                <Box sx={{ position: 'relative', border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 1, maxWidth: '100%', overflow: 'auto' }}>
                    <CopyButton text={raw} />
                    <Tooltip title="Ver renderizado">
                        <IconButton
                            size="small"
                            onClick={() => setOpen(true)}
                            sx={{ position: 'absolute', top: 6, right: 40, bgcolor: 'action.hover' }}
                        >
                            <VisibilityIcon fontSize="inherit" />
                        </IconButton>
                    </Tooltip>
                    <pre className={className} style={{ margin: 0, overflow: 'auto' }}>
                        <code {...rest}>{raw}</code>
                    </pre>
                    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
                        <DialogContent sx={{ p: 0 }}>
                            <iframe
                                title="preview"
                                sandbox=""
                                style={{ width: '100%', height: '80vh', border: 'none', display: 'block' }}
                                srcDoc={raw}
                            />
                        </DialogContent>
                    </Dialog>
                </Box>
            );
        }

        // Otros lenguajes
        return (
            <Box sx={{ position: 'relative', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, mb: 1, maxWidth: '100%', overflow: 'auto' }}>
                <CopyButton text={raw} />
                <pre className={className} style={{ margin: 0, overflow: 'auto' }}>
                    <code {...rest}>{children}</code>
                </pre>
            </Box>
        );
    }
};

export default function MarkdownRenderer({ content }: Props) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight as any]}
            components={components}
        >
            {content}
        </ReactMarkdown>
    );
}
