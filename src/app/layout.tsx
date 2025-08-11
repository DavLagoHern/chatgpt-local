import Providers from './providers';
import { Box, CssBaseline } from '@mui/material';
import SideBar from './components/SideBar';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          <CssBaseline />
          <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
            <SideBar />
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {children}
            </Box>
          </Box>
        </Providers>
      </body>
    </html>
  );
}
