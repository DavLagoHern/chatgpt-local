'use client';
import { Box } from '@mui/material';

export default function Typing() {
    return (
        <Box
            sx={{
                display: 'inline-flex',
                gap: 0.8,
                alignItems: 'center',
                px: 1.5, py: 1,
                borderRadius: 2,
                bgcolor: 'background.default',
                color: 'text.secondary',
                fontSize: 13,
                lineHeight: 1,
                userSelect: 'none'
            }}
            aria-label="pensando"
        >
            <span>Pensando</span>
            <Box component="span" sx={{
                display: 'inline-flex', gap: 0.4, ml: 0.6
            }}>
                {[0, 1, 2].map(i => (
                    <Box key={i} sx={{
                        width: 6, height: 6, borderRadius: '50%',
                        bgcolor: 'text.disabled',
                        animation: 'blink 1.2s infinite',
                        animationDelay: `${i * 0.2}s`
                    }} />
                ))}
            </Box>
            <style jsx global>{`
        @keyframes blink {
          0% { opacity: .2; transform: translateY(0px); }
          50% { opacity: 1; transform: translateY(-2px); }
          100% { opacity: .2; transform: translateY(0px); }
        }
      `}</style>
        </Box>
    );
}
