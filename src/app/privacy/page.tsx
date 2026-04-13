// ============================================================
// Privacy Policy — YupSoul Content Manager
// URL: /privacy
// ============================================================

export const metadata = {
  title: 'Privacy Policy — YupSoul Content Manager',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen p-6 md:p-12">
      <article className="max-w-3xl mx-auto text-[var(--nebula-gray)] leading-relaxed">
        <h1 className="text-3xl font-bold gold-accent mb-2">Privacy Policy</h1>
        <p className="text-sm text-[var(--nebula-gray)] mb-8">Last updated: April 13, 2026</p>

        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-[var(--star-white)] mb-2">1. Introduction</h2>
            <p>
              YupSoul Content Manager (&quot;the App&quot;) is a content management tool operated by YupSoul
              for publishing astrology and AI-music related content to social media platforms, including TikTok.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[var(--star-white)] mb-2">2. Data We Access</h2>
            <p>When you connect your TikTok account to the App, we access:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Basic account information (username, display name, avatar)</li>
              <li>Ability to publish content (photos and videos) on your behalf</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[var(--star-white)] mb-2">3. Data We Do NOT Collect</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>Personal messages or direct messages</li>
              <li>Follower or following lists</li>
              <li>Analytics or insights data of other users</li>
              <li>Financial or payment information</li>
              <li>Location data</li>
              <li>Contact lists</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[var(--star-white)] mb-2">4. How We Use Your Data</h2>
            <p>Your account information is used solely to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Authenticate your identity for content publishing</li>
              <li>Publish content (photo carousels and videos) to your TikTok account</li>
              <li>Display your account name in the management dashboard</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[var(--star-white)] mb-2">5. Data Sharing</h2>
            <p>
              We do not sell, trade, or share your personal data with any third parties.
              Your data is only transmitted between the App and the TikTok API as required
              for content publishing functionality.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[var(--star-white)] mb-2">6. Data Storage &amp; Security</h2>
            <p>
              Access tokens are stored securely as environment variables and are never exposed
              to client-side code. We do not maintain a database of user personal information.
              All content is generated programmatically and does not contain personal user data.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[var(--star-white)] mb-2">7. Data Retention</h2>
            <p>
              We retain access tokens only for as long as needed to provide the service.
              You can revoke access at any time by disconnecting the App from your TikTok
              account settings. Upon disconnection, all stored tokens are deleted.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[var(--star-white)] mb-2">8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Request information about data we hold about you</li>
              <li>Request deletion of your data</li>
              <li>Revoke the App&apos;s access to your TikTok account at any time</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[var(--star-white)] mb-2">9. Children&apos;s Privacy</h2>
            <p>
              The App is not intended for use by individuals under the age of 18.
              We do not knowingly collect data from minors.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[var(--star-white)] mb-2">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted
              on this page with an updated revision date.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[var(--star-white)] mb-2">11. Contact</h2>
            <p>
              For questions about this Privacy Policy, please contact us via
              the YupSoul Telegram bot:{' '}
              <a href="https://t.me/Yup_Soul_bot?start=ref_miplix" className="lavender-accent hover:underline">
                @Yup_Soul_bot
              </a>
            </p>
            <p className="mt-2">
              Website:{' '}
              <a href="https://www.yupsoul.online/" className="lavender-accent hover:underline">
                yupsoul.online
              </a>
            </p>
          </div>
        </section>
      </article>
    </div>
  );
}
