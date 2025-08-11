'use client';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { getTheme } from './theme';

export default function Providers({ children }: { children: ReactNode }) {
    const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
    const [mode, setMode] = useState<'light' | 'dark'>('light');

    useEffect(() => { setMode(prefersDark ? 'dark' : 'light'); }, [prefersDark]);
    const theme = useMemo(() => getTheme(mode), [mode]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
