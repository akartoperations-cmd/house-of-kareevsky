export default function PrivacyPage() {
  const privacyPolicyText = `PRIVACY POLICY
Last updated: February 7, 2026

1. GENERAL PROVISIONS
1.1. This Privacy Policy explains how Adilet Imankariev (“Owner”, “we”, “us”) collects, uses, stores, and protects personal data through the “House of Kareevsky” platform (the “Platform”).
1.2. Data Controller (Owner):
Adilet Imankariev
Vlasova 24a, 720000 Bishkek, Kyrgyzstan
Email: a.k.artoperations@gmail.com
1.3. We process personal data in accordance with the Law of the Kyrgyz Republic “On Personal Information” and, where applicable, the EU General Data Protection Regulation (GDPR).

2. DIGISTORE24 AS MERCHANT OF RECORD (PAYMENTS)
2.1. All payments are processed by Digistore24 GmbH (Germany) acting as the Merchant of Record.
2.2. Digistore24 processes payment and billing data as an independent data controller. We do not receive, see, or store your credit card details or bank information.
2.3. We receive only the minimum information needed to grant access (for example: email address, subscription status, product/plan identifiers, order/transaction identifiers).

3. DATA WE COLLECT
We may process the following categories of data:
3.1. Identity & Contact Data: email address (used to create access and communicate about your account).
3.2. Subscription Data: active/inactive status, plan identifiers, timestamps/events related to your subscription (used to grant or block access).
3.3. Technical Data: IP address, device/browser information, basic server logs, error logs (used for security and stability).
3.4. PWA Storage Data: essential Local Storage / cookies used strictly for session persistence (keeping you logged in) and basic interface preferences.
3.5. Push Notification Data (if you enable push): device identifiers / push tokens used only to deliver notifications you opted into.

4. PURPOSES OF PROCESSING
We process personal data to:
4.1. Provide access to the Platform and its content feed.
4.2. Verify subscription status and manage access (including fraud prevention and access control).
4.3. Provide customer support and respond to requests.
4.4. Maintain security, prevent unauthorized access, and ensure technical reliability.
4.5. Send service-related messages (for example: access emails, important updates). Marketing emails are sent only if required by law and only where you have consented (if applicable).

5. LEGAL BASIS (GDPR)
Where GDPR applies, we rely on the following legal bases:
5.1. Article 6(1)(b) GDPR (Performance of a contract): to provide access and deliver the subscription service.
5.2. Article 6(1)(f) GDPR (Legitimate interests): to secure the Platform, prevent abuse, and keep the service reliable.
5.3. Article 6(1)(c) GDPR (Legal obligation): where we must comply with applicable laws.

6. COOKIES / LOCAL STORAGE
6.1. The Platform uses essential cookies and/or Local Storage to maintain your session and basic preferences.
6.2. We do not use advertising cookies. If we add any non-essential tracking in the future, we will request consent where required by law.
6.3. If you clear Local Storage/cookies, you may need to re-authenticate.

7. PUSH NOTIFICATIONS
7.1. If you choose to enable push notifications, we process a push token/device identifier in order to send notifications (for example: new posts).
7.2. You can disable push notifications at any time in your device/browser settings.

8. DATA SHARING
8.1. We do not sell or rent your personal data.
8.2. We share data only with service providers necessary to operate the Platform, such as:
(a) Digistore24 (payment/subscription synchronization),
(b) hosting/database/auth providers (e.g., Supabase),
(c) push notification provider (if enabled).
8.3. These providers process data only to deliver their services and under appropriate contractual safeguards.

9. INTERNATIONAL TRANSFERS
9.1. Your data may be processed on servers located outside your country and/or outside the EEA.
9.2. Where required, we use appropriate safeguards (for example: contractual protections with providers) to protect personal data.

10. DATA RETENTION
10.1. We retain account and subscription data while your subscription is active.
10.2. After cancellation/expiration, we may retain minimal records for a reasonable period (up to 24 months) for support, dispute handling, fraud prevention, and compliance, unless deletion is requested and not prohibited by law.

11. YOUR RIGHTS
Where GDPR applies, you may have the right to access, correct, delete, restrict, or object to processing, and request data portability.
To exercise these rights, contact: a.k.artoperations@gmail.com

12. SECURITY
12.1. We apply reasonable technical and organizational measures to protect data (access controls, secure storage, logging).
12.2. The Platform is intended for personal viewing/listening/reading only. Unauthorized copying, redistribution, or other misuse is prohibited.

13. CONTACT
Owner/Data Controller:
Adilet Imankariev
Vlasova 24a, 720000 Bishkek, Kyrgyzstan
Email: a.k.artoperations@gmail.com
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
            Privacy Policy
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: '#666', marginTop: '8px' }}>
            Last updated: February 7, 2026
          </p>
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
          {privacyPolicyText}
        </div>
      </div>
    </div>
  );
}

