/**
 * "Sign in with Linear": a plain link to the read-only OAuth start route. It is
 * always on the landing page next to the floppy flow, so signing in never
 * depends on the animation, a drag, or JavaScript.
 */
export function SignInButton({ href }: { href: string }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <a href={href} className="term-btn">
        <LinearMark />
        Skip boot: sign in with Linear
      </a>
      <p className="text-base text-ph/75">Read-only access, nothing stored.</p>
    </div>
  );
}

function LinearMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true" fill="currentColor">
      <path d="M1.2 61.4a50 50 0 0 0 37.4 37.4L1.2 61.4Zm-1-14.9L53.5 99.8c3-.3 6-.9 8.8-1.7L1.9 37.6c-.8 2.8-1.4 5.7-1.7 8.9Zm5.4-18.1 66 66a50 50 0 0 0 6.9-4.5L10.1 21.5a50 50 0 0 0-4.5 6.9Zm12-17.5a50 50 0 0 1 70.7 70.7L17.6 10.9Z" />
    </svg>
  );
}
