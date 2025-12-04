import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Digital Sanctuary",
  description: "Privacy Policy for House of Kareevsky - Digital Sanctuary",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-cream-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white rounded-xl shadow-sm border border-sand-200 p-8 md:p-12">
          <h1 className="font-heading text-4xl md:text-5xl text-charcoal-900 mb-4">
            Privacy Policy
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
                Introduction
              </h2>
              <p className="mb-4">
                Privacy Policy for House of Kareevsky - Digital Sanctuary (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). 
                This Privacy Policy describes how we collect, use, and protect your personal information 
                when you use our digital sanctuary platform for exclusive artistic content.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Information We Collect
              </h2>
              <p className="mb-4">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside mb-4 space-y-2">
                <li>Name and email address when you create an account</li>
                <li>Payment information processed through our payment provider (Digistore24)</li>
                <li>Content preferences and language settings</li>
                <li>Comments and interactions with our content</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                How We Use Your Information
              </h2>
              <p className="mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside mb-4 space-y-2">
                <li>Provide and maintain our service</li>
                <li>Process payments and manage subscriptions</li>
                <li>Send you updates about exclusive content</li>
                <li>Improve our platform and user experience</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Data Security
              </h2>
              <p className="mb-4">
                We implement appropriate technical and organizational measures to protect your personal 
                information. However, no method of transmission over the internet is 100% secure, and 
                we cannot guarantee absolute security.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Third-Party Services
              </h2>
              <p className="mb-4">
                We use third-party services including Supabase for authentication and data storage, 
                and Digistore24 for payment processing. These services have their own privacy policies 
                governing the use of your information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Your Rights
              </h2>
              <p className="mb-4">
                You have the right to access, update, or delete your personal information at any time. 
                You can do this through your account settings or by contacting us directly.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Changes to This Policy
              </h2>
              <p className="mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any changes 
                by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading text-2xl text-charcoal-900 mb-4">
                Contact Us
              </h2>
              <p className="mb-4">
                If you have any questions about this Privacy Policy, please contact us through your 
                preferred communication channel.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

