import type { Metadata } from 'next';
import { appUrl } from '@/lib/urls';
import './globals.css';
export const metadata: Metadata = {
  title: 'Кряк-при — кто сегодня ведёт дейлик?',
  description:
    'Пинбол 3D для команды до восьми человек. Пройдите три уровня карты «Глубина» и узнайте, кто сегодня ведёт дейлик.',
  icons: { icon: appUrl('/duck.png') },
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
