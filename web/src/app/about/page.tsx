import Link from "next/link";

const SAMPLE_CARD = {
  name: "Moon Bakery Orders Agent",
  description: "Place and track orders at Moon Bakery.",
  url: "https://moonbakery-orders.aws.example.com",
  version: "1.0",
  capabilities: { streaming: false, pushNotifications: false },
  authentication: { schemes: ["Bearer"] },
  skills: [
    { name: "placeOrder", description: "Place a new bakery order" },
    { name: "trackOrder", description: "Track an existing order status" },
  ],
  provider: { organization: "Moon Bakery", url: "https://moonbakery.com" },
  _meta: {
    identifier: "urn:ai:domain:moonbakery.com:agent:orders",
    publicUrl: "https://agentcards.host39.org/moonbakery.com/orders.json",
    hostedBy: "host39.org",
  },
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface-light px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-weak">
            Agent Card Hosting
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-strong leading-tight tracking-[-0.01em]">
            host your agents
            <br />
            <span className="text-ink-weak">at predictable URLs</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-medium">
            host39 is a third-party A2A agent card host. Register your identity, create agent cards,
            and publish them at stable public URLs - no server required.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-9 rounded-control bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 transition"
            >
              Get started free
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center h-9 rounded-control border-2 border-line bg-surface-light px-3 text-sm font-medium text-ink hover:border-line-strong transition"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-weak">
          How it works
        </p>
        <h2 className="mb-8 font-display text-2xl font-bold text-ink-strong leading-tight">
          Three steps to publish your agent
        </h2>

        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Register",
              desc: "Create an account with your email or a domain identity (for businesses). Domain users get URLs like /moonbakery.com/orders.json.",
            },
            {
              step: "02",
              title: "Create a card",
              desc: "Fill in your agent name, runtime URL, capabilities, authentication, and skills using our guided form.",
            },
            {
              step: "03",
              title: "Share the URL",
              desc: "Your card is live at a stable public URL. Register it with the NANDA Index so resolvers can find your agent by identity.",
            },
          ].map((item) => (
            <article
              key={item.step}
              className="bg-surface-light rounded-card border border-line/70 shadow-card p-4 hover:shadow-card-hover hover:border-line-strong transition flex flex-col h-full gap-3"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-200 text-xs font-semibold text-brand-800">
                {item.step}
              </span>
              <h3 className="font-semibold text-ink-strong">{item.title}</h3>
              <p className="text-sm text-ink leading-relaxed">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* URL patterns */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-weak">
          URL patterns
        </p>
        <h2 className="mb-8 font-display text-2xl font-bold text-ink-strong leading-tight">
          Predictable, stable, public
        </h2>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-card border border-line-strong bg-brand-200 p-6 shadow-card">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-800">Business / Domain</p>
            <code className="mt-3 block rounded-control border border-line bg-surface-light p-4 font-mono text-sm text-brand-800">
              /moonbakery.com/orders.json
            </code>
            <p className="mt-3 text-sm leading-relaxed text-ink-medium">
              Register with a domain identity to get clean, branded URLs for your business agents.
            </p>
          </div>
          <div className="rounded-card border border-line-strong bg-accent-teal p-6 shadow-card">
            <p className="text-xs font-bold uppercase tracking-wide text-accent-teal-ink">Personal / Email</p>
            <code className="mt-3 block rounded-control border border-line bg-surface-light p-4 font-mono text-sm text-accent-teal-ink">
              /personal/john@hotmail.com/card.json
            </code>
            <p className="mt-3 text-sm leading-relaxed text-ink-medium">
              Register with your email for personal agent cards - great for developers and individuals.
            </p>
          </div>
        </div>
      </section>

      {/* Sample agent card */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-weak">
          A2A Agent Card format
        </p>
        <h2 className="mb-8 font-display text-2xl font-bold text-ink-strong leading-tight">
          Standard JSON, served instantly
        </h2>

        <div className="overflow-x-auto rounded-card border border-line bg-brand-800 p-6 shadow-card">
          <pre className="font-mono text-sm leading-6 text-surface-light">
            {JSON.stringify(SAMPLE_CARD, null, 2)}
          </pre>
        </div>
      </section>
    </>
  );
}
