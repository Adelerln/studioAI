import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Header } from '@/components/layout';

export const metadata: Metadata = {
  title: 'Resacolo Studio | AI Image Editor',
  description: 'Upload an image, describe the desired output, and let AI transform your visual.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Header />
          <main
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
