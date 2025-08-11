'use client';
import { Box, Paper } from '@mui/material';
import Chat from './components/Chat';

export default function Page() {
  return (
    <Box sx={{ flex: 1, py: 2, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
      <Paper
        variant="outlined"
        sx={{
          width: 'min(900px, 100%)',
          mx: 2,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 2,
          flex: 1
        }}
      >
        <Chat />
      </Paper>
    </Box>
  );
}
