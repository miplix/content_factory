import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YupSoul Content Factory",
  description: "Контент-завод YupSoul — автоматическая генерация и публикация космического контента",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        {children}
      </body>
    </html>
  );
}
