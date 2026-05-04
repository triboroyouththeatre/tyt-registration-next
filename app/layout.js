import "./globals.css";

export const metadata = {
  title: "TYT Family Portal",
  description: "Triboro Youth Theatre Family Portal",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}