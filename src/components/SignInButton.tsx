/**
 * The quiet fallback: a plain link to the read-only OAuth start route. The
 * cassette is the main way in; this is for visitors without JavaScript and for
 * anyone who would rather not drag. It is deliberately small text, not a button.
 */
export function SignInButton({ href }: { href: string }) {
  return (
    <div className="flex flex-col items-start gap-0.5 sm:items-end">
      <a href={href} className="landing-link">
        Sign in without the cassette
      </a>
      <p className="landing-tagline text-base text-ph/75">Read-only access, nothing stored.</p>
    </div>
  );
}
