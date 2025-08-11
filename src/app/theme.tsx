'use client';
import { createTheme } from '@mui/material/styles';

export function getTheme(mode: 'light' | 'dark') {
    return createTheme({
        palette: {
            mode,
            primary: { main: mode === 'dark' ? '#90caf9' : '#1976d2' },
            background: {
                default: mode === 'dark' ? '#0f1115' : '#fafafa',
                paper: mode === 'dark' ? '#121418' : '#fff'
            }
        },
        shape: { borderRadius: 10 }
    });
}
