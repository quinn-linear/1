/** "Sign in with Linear": links to the read-only OAuth start route. */
export function SignInButton({ href }: { href: string }) {
  const className =
    "group inline-flex w-full items-center justify-center gap-3 rounded-full bg-white px-8 py-4 text-base font-semibold text-black shadow-[0_0_60px_-12px_rgba(167,139,250,0.9)] transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:w-auto";

  const content = (
    <>
      <LinearMark />
      Sign in with Linear
    </>
  );

  return (
    <div className="flex flex-col items-start gap-3">
      <a href={href} className={`${className} hover:scale-105 active:scale-95`}>
        {content}
      </a>
      <p className="text-sm text-white/50">Read-only access, nothing stored.</p>
    </div>
  );
}

function LinearMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 100 100" aria-hidden="true" fill="currentColor">
      <path d="M1.2 61.4a50 50 0 0 0 37.4 37.4L1.2 61.4Zm-1-14.9L53.5 99.8c3-.3 6-.9 8.8-1.7L1.9 37.6c-.8 2.8-1.4 5.7-1.7 8.9Zm5.4-18.1 66 66a50 50 0 0 0 6.9-4.5L10.1 21.5a50 50 0 0 0-4.5 6.9Zm12-17.5a50 50 0 0 1 70.7 70.7L17.6 10.9Z" />
    </svg>
  );
}
