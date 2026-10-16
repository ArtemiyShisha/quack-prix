import type { Metadata } from 'next';
import { appUrl } from '@/lib/urls';
import './globals.css';
export const metadata: Metadata = {
  title: 'Кряк-при — кто сегодня ведёт дейлик?',
  description:
    'Аквапарк, «Шарики 3D» и пинбол для команды до восьми человек. Игра определит, кто сегодня ведёт дейлик.',
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
