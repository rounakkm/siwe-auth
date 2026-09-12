export default function HomePage() {
  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "4rem 2rem" }}>
      <header style={{ marginBottom: "2.5rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
          SIWE Session Authentication
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "1.1rem" }}>
          Road To Devcon - IV (Problem 2): &ldquo;Log In With a Wallet, Trust Only the Signature&rdquo;
        </p>
      </header>

      <section
        style={{
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: "8px",
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Project Overview</h2>
        <p style={{ marginBottom: "1rem", color: "var(--muted)" }}>
          This prototype demonstrates wallet-based session authentication with strict cryptographic verification.
        </p>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <div>
            <strong>Status:</strong> <span style={{ color: "var(--accent)" }}>Foundation & Project Scaffolding Ready</span>
          </div>
          <div>
            <strong>Architecture:</strong> Next.js App Router, TypeScript, SIWE (EIP-4361), Iron Session, Viem, Wagmi
          </div>
          <div>
            <strong>Health Check:</strong>{" "}
            <a href="/api/health" target="_blank" rel="noopener noreferrer">
              /api/health
            </a>
          </div>
        </div>
      </section>

      <section
        style={{
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: "8px",
          padding: "1.5rem",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Planned Authentication Features</h2>
        <ul style={{ paddingLeft: "1.25rem", color: "var(--muted)", display: "grid", gap: "0.5rem" }}>
          <li>Server-side nonce generation and replay protection</li>
          <li>EIP-4361 SIWE message formatting and verification</li>
          <li>EOA signature verification via standard cryptographic recovery</li>
          <li>Smart Contract Account signature verification (ERC-1271)</li>
          <li>Stateless encrypted cookie-based session management (`iron-session`)</li>
          <li>Role-based access control and protected seller routes</li>
        </ul>
      </section>
    </main>
  );
}
