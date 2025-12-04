import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-cream-100 border-t border-sand-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="text-sm text-charcoal-600 font-ui">
              © {currentYear} House of Kareevsky - Digital Sanctuary. All rights reserved.
            </p>
          </div>
          
          <nav className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-sm text-charcoal-600 hover:text-charcoal-900 font-ui transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="text-charcoal-400">•</span>
            <Link
              href="/terms"
              className="text-sm text-charcoal-600 hover:text-charcoal-900 font-ui transition-colors"
            >
              Terms of Service
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

