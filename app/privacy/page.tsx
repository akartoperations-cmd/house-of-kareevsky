export default function PrivacyPage() {
  return (
    <div className="welcome-page">
      <div className="welcome-card">
        <div className="welcome-hero welcome-hero--simple">
          <div className="welcome-tagline">Documents</div>
          <h1 className="welcome-doc-title">Privacy</h1>
        </div>

        <div className="welcome-block">
          <p>
            This is a private space. Emails are used only to send secure access links. No trackers or
            ads are added here. Media shared inside the app stays private to invited members and is
            not sold or given to third parties.
          </p>
          <p style={{ marginTop: '12px' }}>
            A fuller Privacy Notice will be published with the Digistore24 integration. If you need
            anything removed, contact Kareevsky directly inside the app once you are signed in.
          </p>
        </div>
      </div>
    </div>
  );
}

