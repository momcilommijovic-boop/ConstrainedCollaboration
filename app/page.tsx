import Link from 'next/link'

const STAGES = [
  { name: 'Forming', desc: 'Members join. Minimum met.' },
  { name: 'Briefing', desc: 'Editor elected. Brief published.' },
  { name: 'Submission', desc: 'Writers submit articles.' },
  { name: 'Editing', desc: 'Editor reviews and assembles.' },
  { name: 'Promotion', desc: 'Members promote the publication.' },
  { name: 'Complete', desc: 'Scores updated. Cycle repeats.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      {/* Nav */}
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <span className="font-serif-display text-xl text-near-black tracking-tight">Quorum</span>
        <div className="flex items-center gap-6">
          <Link
            href="/login"
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="font-mono text-xs bg-near-black text-off-white border border-near-black px-4 py-2 hover:bg-accent-red hover:border-accent-red transition-colors"
          >
            Start a Cell →
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="px-8 pt-20 pb-16 border-b border-near-black/20">
          <div className="max-w-4xl">
            <h1 className="font-serif-display text-6xl leading-[1.05] text-near-black mb-8 max-w-2xl">
              The deadline is not a suggestion.
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl">
              <p className="font-body text-lg text-near-black/80 leading-relaxed">
                Quorum runs structured publishing projects called{' '}
                <strong className="font-semibold">Cells</strong>. A group of people. A brief.
                A deadline. An automated system that enforces all three.
              </p>
              <p className="font-body text-lg text-near-black/80 leading-relaxed">
                Members are assigned roles, earn merit, and face real consequences for missing
                deadlines. No exceptions. No overrides. The process is the product.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-8 py-16 border-b border-near-black/20">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-10">
            How a Cell works
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0 border border-near-black/20">
            {STAGES.map((stage, i) => (
              <div
                key={stage.name}
                className={`px-4 py-5 ${i < STAGES.length - 1 ? 'border-r border-near-black/20' : ''}`}
              >
                <div className="font-mono text-xs text-olive mb-2">{String(i + 1).padStart(2, '0')}</div>
                <div className="font-serif-display text-base mb-2">{stage.name}</div>
                <div className="font-mono text-xs text-olive leading-relaxed">{stage.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* The rules */}
        <section className="px-8 py-16 border-b border-near-black/20">
          <div className="max-w-3xl grid md:grid-cols-2 gap-12">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-olive mb-6">
                The system, not you
              </p>
              <ul className="space-y-3">
                {[
                  'Editors are elected, not chosen.',
                  'Deadlines are enforced automatically.',
                  'Penalties are applied without appeal.',
                  'Merit is memory — it follows you.',
                ].map((rule) => (
                  <li key={rule} className="flex gap-3 items-start">
                    <span className="font-mono text-xs text-accent-red mt-0.5">—</span>
                    <span className="font-body text-base text-near-black/80">{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-olive mb-6">
                What you get
              </p>
              <ul className="space-y-3">
                {[
                  'A published e-zine every cycle.',
                  'Real editorial structure without managers.',
                  'A public record of contribution.',
                  'A group of people serious about finishing.',
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start">
                    <span className="font-mono text-xs text-olive mt-0.5">+</span>
                    <span className="font-body text-base text-near-black/80">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-8 py-20">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-6">
            Ready?
          </p>
          <h2 className="font-serif-display text-4xl mb-8">
            Start a Cell or join one.
          </h2>
          <div className="flex gap-4 flex-wrap">
            <Link
              href="/signup"
              className="font-mono text-sm bg-near-black text-off-white border border-near-black px-6 py-3 hover:bg-accent-red hover:border-accent-red transition-colors"
            >
              Create an account →
            </Link>
            <Link
              href="/cells"
              className="font-mono text-sm border border-near-black text-near-black px-6 py-3 hover:bg-near-black hover:text-off-white transition-colors"
            >
              Browse open Cells
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-near-black/20 px-8 py-4 flex items-center justify-between">
        <span className="font-mono text-xs text-olive">Quorum</span>
        <span className="font-mono text-xs text-olive">Constraint is the point.</span>
      </footer>
    </div>
  )
}
