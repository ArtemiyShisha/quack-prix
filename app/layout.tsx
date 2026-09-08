import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Кряк-при — кто сегодня ведёт дейлик?',
  description:
    'Впишите до восьми имён, выпустите уток на трассу и узнайте, кто сегодня ведёт дейлик.',
  icons: { icon: '/duck.png' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
