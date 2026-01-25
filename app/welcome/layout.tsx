export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Digistore24 scripts - exact format required by validator */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://www.digistore24-scripts.com/service/digistore.js" />
      <script
        dangerouslySetInnerHTML={{
          __html: `digistorePromocode({ "product_id": 663981, "adjust_domain": true });`,
        }}
      />
      {children}
    </>
  );
}
