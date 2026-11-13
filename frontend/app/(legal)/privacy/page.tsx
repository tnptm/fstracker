import {
  CONTROLLER_EMAIL,
  CONTROLLER_NAME,
  CONTROLLER_URL,
  INACTIVE_ACCOUNT_MONTHS,
  POLICY_UPDATED,
  POLICY_VERSION,
} from "@/lib/privacy";

export const metadata = { title: "Privacy policy" };

const link = "font-medium text-teal-700 underline dark:text-teal-300";
const h2 = "mt-8 mb-2 text-lg font-semibold tracking-tight";
const ul = "list-disc space-y-1.5 pl-5";

export default function PrivacyPage() {
  return (
    <article className="space-y-3 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
        Privacy policy
      </h1>
      <p className="muted">
        Last updated {POLICY_UPDATED} (version {POLICY_VERSION})
      </p>
      <p>
        fstracker helps you keep track of your voluntary work hours. This page explains what
        personal data the app handles, why, how long it is kept, and how you stay in control of it.
        It follows the EU General Data Protection Regulation (GDPR).
      </p>
      <p className="rounded-2xl bg-teal-50 px-4 py-3 font-medium text-teal-900 dark:bg-teal-500/10 dark:text-teal-100">
        In short: we only keep the data the app needs to work. We never share, sell or disclose it
        to any third party. You can download or delete all of it at any time.
      </p>

      <h2 className={h2}>1. Who is responsible</h2>
      <p>
        The data controller is {CONTROLLER_NAME}, who runs this service. Contact:{" "}
        <a className={link} href={CONTROLLER_URL} rel="noopener noreferrer">
          {CONTROLLER_URL.replace("https://", "")}
        </a>
        {CONTROLLER_EMAIL && (
          <>
            {" "}
            or{" "}
            <a className={link} href={`mailto:${CONTROLLER_EMAIL}`}>
              {CONTROLLER_EMAIL}
            </a>
          </>
        )}
        .
      </p>

      <h2 className={h2}>2. What data we collect and why</h2>
      <p>We collect only what is needed to provide the app:</p>
      <ul className={ul}>
        <li>
          <strong>Account data:</strong> a random username that the server creates for you, and
          your password. The password is stored only as a salted hash, never in readable form.
          They are used to create your account, let you log in and keep your account secure. We
          do not ask for your name or email address, so the account does not reveal who you are.
        </li>
        <li>
          <strong>Volunteer data you enter:</strong> time entries (start and end time, comment),
          day notes (day off, sick, vacation or other, with a comment), monthly hour goals and
          monthly course counts (each with an optional comment). This is the app&rsquo;s main
          function: showing your history and statistics to you.
        </li>
        <li>
          <strong>Sign-up record:</strong> the date and the policy version you accepted when
          creating your account (or later, if you accepted a newer version), and when your account
          was created and last used to log in.
        </li>
        <li>
          <strong>Technical data:</strong> when you use the app, our server briefly logs your IP
          address, browser type, the requested address and the time of each request. The IP address
          is also counted in memory for about an hour to limit sign-up abuse. We use this only to
          keep the service secure and working, and the logs are rotated automatically.
        </li>
      </ul>
      <p>
        Because there is no email address, we cannot send you messages or reset a lost password:
        keep your username and password safe. Comments and descriptions are stored encrypted with a
        key derived from your password, which the server only holds in memory while you are signed
        in, so they cannot be recovered if you lose your password. Accounts created earlier may still have an email
        address stored; it is not used for anything, and you can remove it under Account. Please
        do not write sensitive or identifying information, such as health details or real names,
        into comments. Whatever you enter is stored exactly as you enter it (encrypted).
      </p>

      <h2 className={h2}>3. Legal basis</h2>
      <ul className={ul}>
        <li>
          Providing the app you asked for (GDPR Art. 6(1)(b)): account data and the volunteer data
          you enter.
        </li>
        <li>
          Our legitimate interest in keeping the service secure and preventing abuse (Art.
          6(1)(f)): technical logs and rate limiting.
        </li>
      </ul>
      <p>
        Ticking the box when you sign up confirms that you have read this policy. It is not
        advertising or tracking consent, because we do not do either.
      </p>

      <h2 className={h2}>4. Who can see your data</h2>
      <p>
        Your data is stored on the server that runs this app. It is not shared with, sold to or
        disclosed to any third party, and the app uses no analytics, advertising or tracking
        services. Fonts and all other files are served from this same site. Only the person who
        runs the service can technically access the database, and only for operating and securing
        it. Other users of the app cannot see your data.
      </p>
      <p>
        We would only disclose data if a law or an authority legally required it.
      </p>

      <h2 className={h2}>5. Cookies and local storage</h2>
      <p>
        The app uses only the cookies and browser storage that are strictly necessary, so no cookie
        banner is needed:
      </p>
      <ul className={ul}>
        <li>
          <code>access_token</code> and <code>refresh_token</code> (cookies): keep you logged in.
          They are HTTP-only, so scripts cannot read them. The session ends after 30 days without
          use, or when you log out.
        </li>
        <li>
          <code>csrftoken</code> (cookie): protects your requests against forged requests.
        </li>
        <li>
          <code>theme</code> (browser local storage): remembers your light or dark theme choice. It
          contains no personal data and is never sent to the server.
        </li>
      </ul>

      <h2 className={h2}>6. How long we keep data</h2>
      <ul className={ul}>
        <li>
          Your account and volunteer data are kept until you delete your account. Deletion is
          immediate and permanent.
        </li>
        <li>
          Accounts that have not been used for {INACTIVE_ACCOUNT_MONTHS} months are deleted
          automatically, together with their data.
        </li>
        <li>
          This is a demo service and it does not currently make database backups. If backups are
          made in the future, they stay with the person who runs the service, are not given to any
          third party, and are replaced on a rolling basis within about two weeks, so deleted data
          disappears from them too.
        </li>
        <li>Technical logs are kept only briefly and rotated automatically.</li>
      </ul>

      <h2 className={h2}>7. How we protect your data</h2>
      <p>
        The connection to the app is encrypted (HTTPS). Passwords are hashed. Login tokens are in
        HTTP-only cookies and every request is protected against cross-site forgery. Each account
        can only reach its own data. Sign-up and login are rate-limited against abuse. If a data
        breach ever puts your rights at risk, we will notify you and the supervisory authority as
        required by law.
      </p>

      <h2 className={h2}>8. Your rights</h2>
      <p>Under the GDPR you have the right to:</p>
      <ul className={ul}>
        <li>
          <strong>Access and portability:</strong> download everything we hold about you as a JSON
          file, under <em>Account → Download my data</em>.
        </li>
        <li>
          <strong>Rectification:</strong> edit or remove your entries, notes, goals and courses in
          the app. Your username is a random code and cannot be changed.
        </li>
        <li>
          <strong>Erasure:</strong> delete your account and all of its data under{" "}
          <em>Account → Delete account</em>.
        </li>
        <li>
          <strong>Restriction and objection:</strong> ask us to limit or stop processing, by
          contacting us (see section 1).
        </li>
      </ul>
      <p>
        We answer requests within one month. You can also contact us for anything the app does not
        cover.
      </p>

      <h2 className={h2}>9. Complaints</h2>
      <p>
        If you think your data is handled unlawfully, you can complain to the data protection
        authority in your country. In Finland this is the Office of the Data Protection Ombudsman
        (
        <a className={link} href="https://tietosuoja.fi" rel="noopener noreferrer">
          tietosuoja.fi
        </a>
        ). We would appreciate the chance to fix the problem first.
      </p>

      <h2 className={h2}>10. Changes</h2>
      <p>
        If this policy changes in a way that matters to you, we will update the version and date
        above, and ask you to read and accept it again in the app.
      </p>
    </article>
  );
}
