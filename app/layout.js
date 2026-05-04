import "./globals.css";

export const metadata = {
  title: "TYT Family Portal",
  description: "Triboro Youth Theatre Family Portal",
};

export default function RootLayout({ children }) {
  // Preconnect hints let the browser start TLS/DNS handshakes for these
  // origins while parsing the HTML, before any JS fires the actual
  // requests. Saves ~100-300ms on first request to each origin —
  // noticeable on the dashboard which fires 6 supabase calls immediately.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/images/tyt-logo.png" type="image/png" />
        {supabaseUrl && (
          <>
            <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseUrl} />
          </>
        )}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}