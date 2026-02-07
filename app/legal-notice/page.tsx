export default function LegalNoticePage() {
  const legalNoticeText = `LEGAL NOTICE (IMPRESSUM)

Information according to § 5 TMG (German Telemedia Act):

Operator / Service Provider:
Adilet Imankariev

Business Name:
House of Kareevsky

Address:
Vlasova 24a
720000 Bishkek
Kyrgyzstan

Contact:
Email: a.k.artoperations@gmail.com

Business Registration:
Registration Number: 004-2025-169-411

Merchant of Record:
Payments, order processing, and invoicing are handled by Digistore24 GmbH (Germany) as Merchant of Record.
`;

  return (
    <div className="welcome-page">
      <div className="welcome-card" style={{ maxWidth: '920px' }}>
        <div className="welcome-hero welcome-hero--simple">
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#666',
            }}
          >
            Documents
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '28px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--text-dark)',
            }}
          >
            Legal Notice
          </h1>
        </div>

        <div
          className="welcome-block"
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '15px',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            marginTop: '14px',
          }}
        >
          {legalNoticeText}
        </div>
      </div>
    </div>
  );
}

