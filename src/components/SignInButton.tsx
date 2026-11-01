/**
 * The plain fallback: a link to the read-only OAuth start route, for keyboard users
 * who would rather not drag (the cassette is also focusable) and for visitors whose
 * assistive tech skips past it. Out of sight until it takes focus.
 */
export function SignInButton({ href }: { href: string }) {
  return (
    <a href={href} className="landing-skip">
      Sign in with Linear (read-only)
    </a>
  );
}
