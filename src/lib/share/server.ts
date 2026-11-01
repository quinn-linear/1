import { getCredentials } from "../auth";

/** Secret used to sign share tokens (the same OAuth client secret that seals the session, via a separate HKDF context). Null if the app isn't configured. */
export const shareSecret = () => getCredentials()?.clientSecret ?? null;
