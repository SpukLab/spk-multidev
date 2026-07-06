export const metadata = {
  title: "SPK_MultiDev",
  description: "Hub multi-AI de SpukLab — chat, code intake y push a GitHub.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#13111f", color: "#eee" }}>
        {children}
      </body>
    </html>
  );
}
