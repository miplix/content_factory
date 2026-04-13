// ============================================================
// YupSoul Content Factory — Dashboard
// ============================================================

export default function Dashboard() {
  return (
    <div className="min-h-screen p-6 md:p-8">
      <header className="max-w-5xl mx-auto mb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">&#x2728;</span>
          <h1 className="text-3xl md:text-4xl font-bold gold-accent">
            YupSoul Content Factory
          </h1>
        </div>
        <p className="text-[var(--nebula-gray)] text-lg">
          Контент-завод — генерация и публикация космического контента
        </p>
      </header>

      <main className="max-w-5xl mx-auto space-y-8">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/api/health" className="cosmic-card cosmic-glow p-6 block transition-all">
            <div className="text-2xl mb-2">&#x1FA7A;</div>
            <h3 className="font-semibold mb-1 text-[var(--star-white)]">Health Check</h3>
            <p className="text-[var(--nebula-gray)] text-sm">&#x1F44B; Spock, &#x043F;&#x0440;&#x043E;&#x0432;&#x0435;&#x0440;&#x044C; &#x0441;&#x0438;&#x0441;&#x0442;&#x0435;&#x043C;&#x0443;</p>
          </a>

          <div className="cosmic-card p-6">
            <div className="text-2xl mb-2">&#x1F517;</div>
            <h3 className="font-semibold mb-3 text-[var(--star-white)]">API Endpoints</h3>
            <ul className="space-y-1.5 text-sm">
              <li><a href="/api/health" className="lavender-accent hover:underline">Health Check</a></li>
              <li><a href="/api/cron/daily" className="lavender-accent hover:underline">Daily Pipeline</a></li>
              <li><a href="/api/cron/report" className="lavender-accent hover:underline">Reports</a></li>
              <li><a href="/api/generate" className="lavender-accent hover:underline">Generate Content</a></li>
            </ul>
          </div>

          <div className="cosmic-card p-6">
            <div className="text-2xl mb-2">&#x1F916;</div>
            <h3 className="font-semibold mb-3 text-[var(--star-white)]">Telegram Bot</h3>
            <ul className="space-y-1.5 text-sm text-[var(--nebula-gray)]">
              <li><code className="text-[var(--soft-gold)]">/status</code> — &#x0441;&#x0442;&#x0430;&#x0442;&#x0443;&#x0441; &#x0441;&#x0438;&#x0441;&#x0442;&#x0435;&#x043C;&#x044B;</li>
              <li><code className="text-[var(--soft-gold)]">/report</code> — &#x043E;&#x0442;&#x0447;&#x0451;&#x0442; &#x0437;&#x0430; &#x0434;&#x0435;&#x043D;&#x044C;</li>
              <li><code className="text-[var(--soft-gold)]">/weekly</code> — &#x043D;&#x0435;&#x0434;&#x0435;&#x043B;&#x044C;&#x043D;&#x044B;&#x0439;</li>
              <li><code className="text-[var(--soft-gold)]">/validate</code> — &#x043F;&#x0440;&#x043E;&#x0432;&#x0435;&#x0440;&#x043A;&#x0430; &#x0421;&#x043F;&#x043E;&#x043A;&#x043E;&#x043C;</li>
              <li><code className="text-[var(--soft-gold)]">/stats</code> — &#x0441;&#x0442;&#x0430;&#x0442;&#x0438;&#x0441;&#x0442;&#x0438;&#x043A;&#x0430;</li>
              <li><code className="text-[var(--soft-gold)]">/zodiac</code> — &#x0437;&#x043D;&#x0430;&#x043A;&#x0438; &#x0437;&#x043E;&#x0434;&#x0438;&#x0430;&#x043A;&#x0430;</li>
            </ul>
          </div>
        </div>

        {/* LLM Providers */}
        <section className="cosmic-card p-6">
          <h2 className="text-xl font-semibold mb-4 gold-accent">&#x1F9E0; LLM-&#x043F;&#x0440;&#x043E;&#x0432;&#x0430;&#x0439;&#x0434;&#x0435;&#x0440;&#x044B; (&#x043F;&#x0440;&#x0438;&#x043E;&#x0440;&#x0438;&#x0442;&#x0435;&#x0442;: &#x0431;&#x0435;&#x0441;&#x043F;&#x043B;&#x0430;&#x0442;&#x043D;&#x044B;&#x0435;)</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
            <ProviderCard name="Gemini" tier="FREE" detail="1000 req/day" priority={1} />
            <ProviderCard name="DeepSeek" tier="FREE" detail="500M tok/mo" priority={2} />
            <ProviderCard name="Ollama" tier="FREE" detail="Local GPU" priority={3} />
            <ProviderCard name="Claude" tier="Paid" detail="~$10/mo" priority={4} />
            <ProviderCard name="OpenAI" tier="Paid" detail="~$10/mo" priority={5} />
          </div>
        </section>

        {/* Platforms */}
        <section className="cosmic-card p-6">
          <h2 className="text-xl font-semibold mb-4 gold-accent">&#x1F4F1; &#x041F;&#x043B;&#x0430;&#x0442;&#x0444;&#x043E;&#x0440;&#x043C;&#x044B;</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm text-center">
            <PlatformCard name="Telegram" posts="3/day" free />
            <PlatformCard name="TikTok" posts="2/day" free />
            <PlatformCard name="Instagram" posts="1/day" free />
            <PlatformCard name="YouTube" posts="1/day" free />
            <PlatformCard name="VK" posts="1/day" free />
            <PlatformCard name="X/Twitter" posts="opt" />
          </div>
        </section>

        {/* Setup Guide */}
        <section className="cosmic-card p-6">
          <h2 className="text-xl font-semibold mb-4 gold-accent">&#x1F4CB; &#x041D;&#x0430;&#x0441;&#x0442;&#x0440;&#x043E;&#x0439;&#x043A;&#x0430;</h2>
          <ol className="space-y-3 text-[var(--nebula-gray)]">
            <li className="flex gap-3">
              <span className="text-[var(--soft-gold)] font-mono">1.</span>
              <span>&#x0421;&#x043A;&#x043E;&#x043F;&#x0438;&#x0440;&#x0443;&#x0439;&#x0442;&#x0435; <code className="cosmic-code">.env.example</code> &#x2192; <code className="cosmic-code">.env.local</code></span>
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--soft-gold)] font-mono">2.</span>
              <span>&#x0414;&#x043E;&#x0431;&#x0430;&#x0432;&#x044C;&#x0442;&#x0435; <code className="cosmic-code">GEMINI_API_KEY</code> (&#x0431;&#x0435;&#x0441;&#x043F;&#x043B;&#x0430;&#x0442;&#x043D;&#x043E;: <a href="https://aistudio.google.com/" className="lavender-accent hover:underline" target="_blank" rel="noopener noreferrer">aistudio.google.com</a>)</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--soft-gold)] font-mono">3.</span>
              <span>&#x0421;&#x043E;&#x0437;&#x0434;&#x0430;&#x0439;&#x0442;&#x0435; Telegram &#x0431;&#x043E;&#x0442;&#x0430; &#x0447;&#x0435;&#x0440;&#x0435;&#x0437; <a href="https://t.me/BotFather" className="lavender-accent hover:underline" target="_blank" rel="noopener noreferrer">@BotFather</a></span>
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--soft-gold)] font-mono">4.</span>
              <span>&#x0414;&#x0435;&#x043F;&#x043B;&#x043E;&#x0439;: <code className="cosmic-code">vercel --prod</code></span>
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--soft-gold)] font-mono">5.</span>
              <span>Webhook: <code className="cosmic-code text-xs">https://api.telegram.org/bot&#123;TOKEN&#125;/setWebhook?url=&#123;URL&#125;/api/webhook/telegram</code></span>
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--soft-gold)] font-mono">6.</span>
              <span>&#x041F;&#x0440;&#x043E;&#x0432;&#x0435;&#x0440;&#x044C;&#x0442;&#x0435;: <code className="cosmic-code">/validate</code> &#x0432; Telegram</span>
            </li>
          </ol>
        </section>

        {/* Rubrics */}
        <section className="cosmic-card p-6">
          <h2 className="text-xl font-semibold mb-4 gold-accent">&#x1F3AD; 20 &#x0420;&#x0443;&#x0431;&#x0440;&#x0438;&#x043A;</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {[
              '&#x1F3B5; &#x0417;&#x0432;&#x0443;&#x043A; &#x0437;&#x043D;&#x0430;&#x043A;&#x0430;', '&#x1F62E; &#x0420;&#x0435;&#x0430;&#x043A;&#x0446;&#x0438;&#x0438;', '&#x1F495; &#x0421;&#x043E;&#x0432;&#x043C;&#x0435;&#x0441;&#x0442;&#x0438;&#x043C;&#x043E;&#x0441;&#x0442;&#x044C;', '&#x2600;&#xFE0F; &#x042D;&#x043D;&#x0435;&#x0440;&#x0433;&#x0438;&#x044F; &#x0434;&#x043D;&#x044F;',
              '&#x1F4D6; &#x0410;&#x0441;&#x0442;&#x0440;&#x043E;-&#x0444;&#x0430;&#x043A;&#x0442;&#x044B;', '&#x1F3B6; &#x0417;&#x043D;&#x0430;&#x043A;&#x0438;=&#x0436;&#x0430;&#x043D;&#x0440;&#x044B;', '&#x1F381; &#x041F;&#x043E;&#x0434;&#x0430;&#x0440;&#x043E;&#x043A;', '&#x1F916; Backstage AI',
              '&#x1F504; &#x0420;&#x0435;&#x0442;&#x0440;&#x043E;&#x0433;&#x0440;&#x0430;&#x0434;', '&#x1F602; &#x041C;&#x0435;&#x043C;&#x044B;', '&#x1F9D8; &#x041C;&#x0435;&#x0434;&#x0438;&#x0442;&#x0430;&#x0446;&#x0438;&#x044F;', '&#x1F50D; &#x0421;&#x0440;&#x0430;&#x0432;&#x043D;&#x0438; &#x0442;&#x0440;&#x0435;&#x043A;',
              '&#x2B50; &#x0417;&#x043D;&#x0430;&#x043C;&#x0435;&#x043D;&#x0438;&#x0442;&#x043E;&#x0441;&#x0442;&#x0438;', '&#x1F315; &#x041F;&#x043E;&#x043B;&#x043D;&#x043E;&#x043B;&#x0443;&#x043D;&#x0438;&#x0435;', '&#x1F4DC; &#x0418;&#x0441;&#x0442;&#x043E;&#x0440;&#x0438;&#x044F;', '&#x2694;&#xFE0F; &#x0411;&#x0430;&#x0442;&#x043B;',
              '&#x1F305; &#x0423;&#x0442;&#x0440;&#x043E;', '&#x1F4F1; &#x0422;&#x0443;&#x0442;&#x043E;&#x0440;&#x0438;&#x0430;&#x043B;', '&#x1F4AC; &#x041E;&#x0442;&#x0437;&#x044B;&#x0432;&#x044B;', '&#x1F30C; Cosmic News',
            ].map((r, i) => (
              <div key={i} className="bg-[var(--deep-space)] rounded-lg px-3 py-2 text-[var(--nebula-gray)]">
                {r}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="max-w-5xl mx-auto mt-12 pt-8 border-t border-[rgba(183,148,246,0.2)] text-[var(--nebula-gray)] text-sm text-center">
        YupSoul Content Factory v1.0 — Powered by Gemini + Vercel
        <br />
        <a href="https://www.yupsoul.online/" className="lavender-accent hover:underline" target="_blank" rel="noopener noreferrer">yupsoul.online</a>
        {' | '}
        <a href="https://t.me/Yup_Soul_bot?start=ref_miplix" className="lavender-accent hover:underline" target="_blank" rel="noopener noreferrer">@Yup_Soul_bot</a>
        <span className="text-[var(--aurora-green)] ml-2">&#x2728; &#x041F;&#x0435;&#x0440;&#x0432;&#x0430;&#x044F; &#x043F;&#x0435;&#x0441;&#x043D;&#x044F; &#x0431;&#x0435;&#x0441;&#x043F;&#x043B;&#x0430;&#x0442;&#x043D;&#x043E;!</span>
      </footer>
    </div>
  );
}

function ProviderCard({ name, tier, detail, priority }: { name: string; tier: string; detail: string; priority: number }) {
  const isFree = tier === 'FREE';
  return (
    <div className={`rounded-lg p-3 text-center ${isFree ? 'bg-[rgba(104,211,145,0.1)] border border-[rgba(104,211,145,0.3)]' : 'bg-[var(--deep-space)] border border-[rgba(160,174,192,0.2)]'}`}>
      <div className="text-xs text-[var(--nebula-gray)] mb-1">#{priority}</div>
      <div className={`font-semibold ${isFree ? 'text-[var(--aurora-green)]' : 'text-[var(--nebula-gray)]'}`}>{name}</div>
      <div className={`text-xs mt-1 ${isFree ? 'text-[var(--aurora-green)]' : 'text-[var(--nebula-gray)]'}`}>{tier}</div>
      <div className="text-xs text-[var(--nebula-gray)] mt-0.5">{detail}</div>
    </div>
  );
}

function PlatformCard({ name, posts, free }: { name: string; posts: string; free?: boolean }) {
  return (
    <div className="bg-[var(--deep-space)] rounded-lg p-3 border border-[rgba(183,148,246,0.15)]">
      <div className="font-semibold text-[var(--star-white)]">{name}</div>
      <div className="text-xs text-[var(--soft-gold)] mt-1">{posts}</div>
      {free && <div className="text-xs text-[var(--aurora-green)] mt-0.5">FREE</div>}
    </div>
  );
}
