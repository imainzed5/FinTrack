import Link from 'next/link';
import {
  TERMS_OF_SERVICE_EFFECTIVE_DATE,
  TERMS_OF_SERVICE_VERSION,
} from '@/lib/policy';

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-cyan-50/30 to-white px-4 py-10 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 sm:px-6">
      <article className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_20px_45px_-24px_rgba(15,23,42,0.4)] dark:border-zinc-800 dark:bg-zinc-900/95 sm:p-8">
        <header className="space-y-3">
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            Terms of Service
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-300">
            Version {TERMS_OF_SERVICE_VERSION} | Effective {TERMS_OF_SERVICE_EFFECTIVE_DATE}
          </p>
        </header>

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-700 dark:text-zinc-200">
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">1. Acceptance of Terms</h2>
            <p>
              By creating an account, accessing, or using FinTrack, you agree to be bound by these
              Terms of Service. If you do not agree with these terms, do not use the service. You
              must be at least the age of legal majority in your jurisdiction to use this service,
              or you must use the service with the consent of a parent or legal guardian.
            </p>
            <p>
              These terms apply to all users, including people who browse public pages and people
              who create an account. Your continued use of FinTrack after changes to these terms
              are posted means you accept the updated terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">2. Account Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your login credentials and
              for all activity that occurs under your account. You agree to provide accurate
              information during signup and to keep your account information up to date.
            </p>
            <p>
              You agree not to share your credentials, attempt to gain unauthorized access to any
              account or system, or use FinTrack in any way that disrupts service reliability or
              security. If you suspect unauthorized access to your account, notify us promptly and
              change your password immediately.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">3. Acceptable Use</h2>
            <p>
              FinTrack is provided to help you manage personal financial records and insights. You
              may not use the service for unlawful activities, fraudulent conduct, harmful
              automation, reverse engineering for abuse, or transmission of malicious code.
            </p>
            <p>
              We reserve the right to suspend or terminate accounts that violate these rules,
              interfere with system operations, or create risks for other users. We may investigate
              and take action as required to protect the service and users.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">4. Financial Information Disclaimer</h2>
            <p>
              FinTrack is an informational tool and does not provide legal, tax, accounting, or
              investment advice. Insights, trends, projections, and recommendations are generated
              from the information you provide and may be incomplete or inaccurate.
            </p>
            <p>
              You are responsible for your financial decisions and for verifying data before acting
              on any recommendation. If you need professional advice, consult a qualified licensed
              advisor.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">5. Service Availability and Changes</h2>
            <p>
              We may update, change, pause, or discontinue features at any time to improve
              performance, security, or compliance. While we strive for high availability, we do
              not guarantee uninterrupted service, error-free operation, or permanent preservation
              of all user content.
            </p>
            <p>
              You are encouraged to keep your own backups of important records. Planned maintenance
              or urgent fixes may occasionally affect access.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">6. Intellectual Property</h2>
            <p>
              The FinTrack application, design, content, branding, and related materials are owned
              by the service operator or its licensors and are protected by applicable intellectual
              property laws. Except where expressly allowed, you may not copy, distribute,
              commercially exploit, or create derivative works from service materials.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, FinTrack is provided on an "as is" and "as
              available" basis without warranties of any kind. We are not liable for indirect,
              incidental, consequential, special, or punitive damages, including loss of profits,
              data, or goodwill, resulting from your use of or inability to use the service.
            </p>
            <p>
              If liability cannot be excluded under applicable law, total liability is limited to
              the amount you paid for the service in the twelve months before the event giving rise
              to the claim, or zero if you used only free services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">8. Termination</h2>
            <p>
              You may stop using FinTrack at any time. We may suspend or terminate your access if
              you violate these terms, create legal risk, or misuse the platform. Sections that by
              nature should survive termination, such as disclaimers, limitations of liability, and
              dispute-related provisions, will continue to apply.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">9. Updates to These Terms</h2>
            <p>
              We may update these terms from time to time. When we do, we will publish a new
              version number and effective date. For material changes, we may require users to
              re-consent before continuing to use protected features.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">10. Contact</h2>
            <p>
              Questions about these Terms of Service can be sent to support@fintrack.app.
            </p>
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4 text-sm dark:border-zinc-800">
          <Link
            href="/auth/signup"
            className="font-semibold text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-4 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
          >
            Back to sign up
          </Link>
          <Link
            href="/auth/privacy"
            className="text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900 dark:text-zinc-200 dark:decoration-zinc-600 dark:hover:text-zinc-100"
          >
            View Privacy Policy
          </Link>
        </footer>
      </article>
    </main>
  );
}
