import Link from 'next/link'

export default function ConfirmPage() {
  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4">
        <Link href="/" className="font-serif-display text-xl text-near-black tracking-tight">
          Quorum
        </Link>
      </header>

      <main className="flex-1 flex items-start justify-center pt-20 px-4">
        <div className="w-full max-w-sm">
          <h1 className="font-serif-display text-3xl mb-4">Check your email</h1>
          <p className="font-body text-base text-near-black/80 mb-6">
            We&apos;ve sent a confirmation link to your email address. Click it to activate
            your account.
          </p>
          <p className="font-mono text-xs text-olive">
            Once confirmed you&apos;ll be taken to your dashboard.
          </p>
        </div>
      </main>
    </div>
  )
}
