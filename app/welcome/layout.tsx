export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Digistore24 scripts moved to root layout for site-wide availability
  return <>{children}</>;
}
