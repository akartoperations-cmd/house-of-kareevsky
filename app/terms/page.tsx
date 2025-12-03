import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Digital Sanctuary",
  description: "Terms of Service for House of Kareevsky - Digital Sanctuary",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-cream-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white rounded-xl shadow-sm border border-sand-200 p-8 md:p-12">
          <h1 className="font-heading text-4xl md:text-5xl text-charcoal-900 mb-4">
            Terms of Service
          </h1>
          <p className="text-sm text-charcoal-500 mb-12">
            Last updated: {new Date().toLocaleDateString("en-US", { 
              year: "numeric", 
              month: "long", 
              day: "numeric" 
            })}
          </p>

          <div className="prose prose-lg max-w-none font-body text-charcoal-800 leading-relaxed readable-content">
            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Agreement to Terms
              </h2>
              <p className="mb-4">
                Terms of Service for House of Kareevsky - Digital Sanctuary ("we," "our," or "us"). 
                By accessing or using our digital sanctuary platform, you agree to be bound by these 
                Terms of Service. If you disagree with any part of these terms, you may not access 
                the service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Subscription Service
              </h2>
              <p className="mb-4">
                Our platform operates on a subscription-based model. By subscribing, you gain access 
                to exclusive artistic content including literature, music, and vlogs.
              </p>
              <ul className="list-disc list-inside mb-4 space-y-2">
                <li>Subscriptions are billed through our payment provider (Digistore24)</li>
                <li>All subscriptions automatically renew unless cancelled</li>
                <li>Refunds are subject to our refund policy and applicable laws</li>
                <li>Access to content is granted based on active subscription status</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Content Protection
              </h2>
              <p className="mb-4">
                All content on this platform is protected by copyright and intellectual property laws. 
                You agree not to:
              </p>
              <ul className="list-disc list-inside mb-4 space-y-2">
                <li>Copy, download, or distribute content without authorization</li>
                <li>Share your account credentials with others</li>
                <li>Attempt to bypass content protection measures</li>
                <li>Use content for commercial purposes without permission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                User Conduct
              </h2>
              <p className="mb-4">
                You agree to use the service in a respectful and lawful manner. You will not:
              </p>
              <ul className="list-disc list-inside mb-4 space-y-2">
                <li>Post offensive, harmful, or inappropriate content in comments</li>
                <li>Harass or threaten other users</li>
                <li>Attempt to gain unauthorized access to the platform</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Account Termination
              </h2>
              <p className="mb-4">
                We reserve the right to suspend or terminate your account at any time for violation 
                of these Terms of Service. Upon termination, your access to the service will be 
                immediately revoked, and you will not be entitled to a refund for any unused 
                subscription period.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Limitation of Liability
              </h2>
              <p className="mb-4">
                To the maximum extent permitted by law, we shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages resulting from your use of 
                or inability to use the service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Changes to Terms
              </h2>
              <p className="mb-4">
                We reserve the right to modify these Terms of Service at any time. We will notify 
                users of any material changes. Your continued use of the service after such changes 
                constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Governing Law
              </h2>
              <p className="mb-4">
                These Terms of Service shall be governed by and construed in accordance with applicable 
                laws, without regard to its conflict of law provisions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Contact Information
              </h2>
              <p className="mb-4">
                If you have any questions about these Terms of Service, please contact us through 
                your preferred communication channel.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

