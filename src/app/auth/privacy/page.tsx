import Link from 'next/link';
import {
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_VERSION,
} from '@/lib/policy';

interface PolicyPageProps {
  searchParams?: Promise<{
    returnTo?: string | string[];
  }>;
}

function resolveReturnTo(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return '/';
  }

  const normalized = candidate.trim();
  if (!normalized.startsWith('/') || normalized.startsWith('//')) {
    return '/';
  }

  return normalized;
}

function getBackLabel(returnTo: string): string {
  if (returnTo === '/auth/signup') {
    return 'Back to sign up';
  }

  if (returnTo === '/') {
    return 'Back to home';
  }

  return 'Back';
}

export default async function PrivacyPolicyPage({ searchParams }: PolicyPageProps) {
  const params: { returnTo?: string | string[] } = (await searchParams) ?? {};
  const returnTo = resolveReturnTo(params.returnTo);
  const termsHref = `/auth/terms?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-cyan-50/30 to-white px-4 py-10 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 sm:px-6">
      <article className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_20px_45px_-24px_rgba(15,23,42,0.4)] dark:border-zinc-800 dark:bg-zinc-900/95 sm:p-8">
        <header className="space-y-3">
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-300">
            Version {PRIVACY_POLICY_VERSION} | Effective {PRIVACY_POLICY_EFFECTIVE_DATE}
          </p>
        </header>

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-700 dark:text-zinc-200">
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">1. Overview</h2>
            <p>
              This Privacy Policy explains how FinTrack collects, uses, stores, and protects your
              personal data when you use our services. We are committed to handling your
              information responsibly and transparently. By creating an account or continuing to
              use FinTrack, you acknowledge this policy.
            </p>
            <p>
              This policy applies to the website, application features, and related support
              services. It does not apply to third-party services that may be linked from within
              FinTrack.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">2. Data We Collect</h2>
            <p>We collect the following categories of data:</p>
            <p>
              Account data: your email address, display name, authentication metadata, and account
              security events.
            </p>
            <p>
              Financial data you provide: transactions, categories, budgets, recurring settings,
              notes, tags, and derived insights.
            </p>
            <p>
              Technical and diagnostic data: browser type, device information, timestamps, and
              limited service logs needed for reliability and abuse prevention.
            </p>
            <p>
              Policy consent records: accepted versions of legal terms, acceptance timestamps, and
              optional context such as user-agent for compliance auditing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">3. How We Use Data</h2>
            <p>We use personal data to provide and improve FinTrack, including to:</p>
            <p>
              Authenticate users, secure accounts, and maintain session integrity.
            </p>
            <p>
              Store and display your expense records, budgets, and analytics.
            </p>
            <p>
              Detect anomalies, prevent misuse, and troubleshoot operational issues.
            </p>
            <p>
              Comply with legal obligations, including maintaining auditable consent records and
              enforcing updated policy acceptance when needed.
            </p>
            <p>
              Communicate service notices related to account security, important updates, or policy
              changes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">4. Legal Bases (Where Applicable)</h2>
            <p>
              Depending on your jurisdiction, our legal bases may include contract performance,
              legitimate interests in providing a secure product, legal compliance, and consent for
              specific processing activities. Where consent is required, you may withdraw it subject
              to legal and operational limits.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">5. Data Sharing</h2>
            <p>
              We do not sell your personal data. We may share data with trusted infrastructure and
              service providers that help us operate FinTrack, such as authentication, hosting, and
              database providers, under confidentiality and security obligations.
            </p>
            <p>
              We may also disclose data when required by law, legal process, or to protect the
              rights, safety, and security of users, the platform, or the public.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">6. Data Retention</h2>
            <p>
              We keep account and financial records while your account is active and for as long as
              needed for legitimate business, legal, or compliance reasons. Consent records may be
              retained longer where required for audit and legal defense purposes.
            </p>
            <p>
              Retention periods can vary by data type, legal requirement, and operational need.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">7. Security</h2>
            <p>
              We use reasonable administrative, technical, and organizational safeguards to protect
              personal data, including access controls, encrypted transport, and monitoring.
              However, no system can be guaranteed to be completely secure. You are responsible for
              maintaining strong account credentials and protecting your own devices.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">8. Your Rights</h2>
            <p>
              Depending on your location, you may have rights to access, correct, delete, restrict,
              or export personal data, and rights to object to certain processing. You may also have
              the right to file a complaint with a data protection authority.
            </p>
            <p>
              To exercise rights, contact support@fintrack.app. We may need to verify your identity
              before fulfilling requests.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">9. International Transfers</h2>
            <p>
              Your information may be processed in countries other than your own. Where required, we
              apply safeguards for international transfers consistent with applicable law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">10. Policy Updates</h2>
            <p>
              We may update this Privacy Policy. Updated versions include a new version number and
              effective date. For material changes, we may request re-consent before continued use
              of account features.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">11. Contact</h2>
            <p>
              For privacy questions or requests, contact support@fintrack.app.
            </p>
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4 text-sm dark:border-zinc-800">
          <Link
            href={returnTo}
            className="font-semibold text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-4 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
          >
            {getBackLabel(returnTo)}
          </Link>
          <Link
            href={termsHref}
            className="text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900 dark:text-zinc-200 dark:decoration-zinc-600 dark:hover:text-zinc-100"
          >
            View Terms of Service
          </Link>
        </footer>
      </article>
    </main>
  );
}
