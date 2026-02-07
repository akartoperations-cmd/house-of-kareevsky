export default function TermsPage() {
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
            TERMS &amp; CONDITIONS
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: '#666', marginTop: '8px' }}>
            (User Agreement / Public Offer)
          </p>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: '#666', marginTop: '4px' }}>
            Last updated: February 6, 2026
          </p>
        </div>

        <div
          className="welcome-block"
          style={{
            maxWidth: '860px',
            margin: '0 auto',
            fontFamily: 'var(--font-ui)',
            fontSize: '15px',
            lineHeight: 1.7,
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginTop: '24px', marginBottom: '12px' }}>
            1. GENERAL PROVISIONS
          </h2>
          <p style={{ marginBottom: '12px' }}>
            1.1. This User Agreement (&quot;Agreement&quot;) governs the relationship between the provider of the digital platform &quot;House of Kareevsky&quot;, Adilet Imankariev (hereinafter – the &quot;Owner&quot;), and the user (hereinafter – the &quot;User&quot;).
          </p>
          <p style={{ marginBottom: '12px' }}>
            1.2. The Platform provides subscription-based access to digital content, including original literary and musical works, cover versions, and AI-assisted content.
          </p>
          <p style={{ marginBottom: '12px' }}>
            1.3. By accessing the Platform or completing a purchase, the User confirms full and unconditional acceptance of this Agreement.
          </p>

          <h2 style={{ fontSize: '18px', fontWeight: '600', marginTop: '24px', marginBottom: '12px' }}>
            CONTRACTUAL PARTNERS (Merchant of Record)
          </h2>
          <p style={{ marginBottom: '12px' }}>
            2.1. For all paid transactions, Digistore24 GmbH (Germany) acts as the Merchant of Record and contractual partner for payment processing and invoicing.
          </p>
          <p style={{ marginBottom: '12px' }}>
            2.2. The financial contract for the subscription is concluded between the User and Digistore24. The Owner remains responsible for providing access to the Platform and delivering the Content.
          </p>

          <h2 style={{ fontSize: '18px', fontWeight: '600', marginTop: '24px', marginBottom: '12px' }}>
            3. RIGHT OF WITHDRAWAL &amp; REFUNDS
          </h2>
          <p style={{ marginBottom: '12px' }}>
            3.1. By purchasing a subscription and gaining immediate access to digital content, the User expressly consents to the immediate performance of the contract and acknowledges that the statutory right of withdrawal may expire once the digital content has been accessed (streamed or viewed), in accordance with applicable EU consumer protection laws.
          </p>
          <p style={{ marginBottom: '12px' }}>
            3.2. Refunds, cancellations, and chargebacks are handled strictly in accordance with Digistore24&apos;s official refund policy and mandatory consumer protection regulations.
          </p>

          <h2 style={{ fontSize: '18px', fontWeight: '600', marginTop: '24px', marginBottom: '12px' }}>
            4. INTELLECTUAL PROPERTY
          </h2>
          <p style={{ marginBottom: '12px' }}>
            4.1. All original literary and musical works published on the Platform are the exclusive intellectual property of the Owner.
          </p>
          <p style={{ marginBottom: '12px' }}>
            4.2. Cover versions are provided for listening purposes only. The Owner ensures that such content is distributed in compliance with standard digital licensing practices.
          </p>
          <p style={{ marginBottom: '12px' }}>
            4.3. The User is granted a non-exclusive, non-transferable license for personal, non-commercial use only. Any reproduction, redistribution, recording, downloading, resale, public performance, or use of the Content for training artificial intelligence systems is strictly prohibited.
          </p>

          <h2 style={{ fontSize: '18px', fontWeight: '600', marginTop: '24px', marginBottom: '12px' }}>
            5. SUBSCRIPTION AND PAYMENTS
          </h2>
          <p style={{ marginBottom: '12px' }}>
            5.1. Access to the Platform is provided on a recurring subscription basis.
          </p>
          <p style={{ marginBottom: '12px' }}>
            5.2. All payments, billing cycles, cancellations, and subscription management are handled via the Digistore24 platform.
          </p>
          <p style={{ marginBottom: '12px' }}>
            5.3. Failure to complete or maintain payment may result in suspension or termination of access.
          </p>

          <h2 style={{ fontSize: '18px', fontWeight: '600', marginTop: '24px', marginBottom: '12px' }}>
            6. LIMITATION OF LIABILITY
          </h2>
          <p style={{ marginBottom: '12px' }}>
            6.1. The Platform and Content are provided on an &quot;as is&quot; and &quot;as available&quot; basis.
          </p>
          <p style={{ marginBottom: '12px' }}>
            6.2. The Owner shall not be liable for temporary service interruptions caused by technical issues, hosting providers, or third-party services.
          </p>

          <h2 style={{ fontSize: '18px', fontWeight: '600', marginTop: '24px', marginBottom: '12px' }}>
            7. GOVERNING LAW
          </h2>
          <p style={{ marginBottom: '12px' }}>
            7.1. This Agreement shall be governed by the laws of the Kyrgyz Republic, subject to mandatory consumer protection laws applicable in the User&apos;s country of residence.
          </p>

          <h2 style={{ fontSize: '18px', fontWeight: '600', marginTop: '24px', marginBottom: '12px' }}>
            8. CONTACT INFORMATION
          </h2>
          <p style={{ marginBottom: '4px' }}>
            <strong>Owner:</strong> Adilet Imankariev
          </p>
          <p style={{ marginBottom: '4px' }}>
            <strong>Address:</strong> Vlasova 24a, 720000 Bishkek, Kyrgyzstan
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>Email:</strong> <a href="mailto:a.k.artoperations@gmail.com" style={{ color: '#666', textDecoration: 'underline' }}>a.k.artoperations@gmail.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}

