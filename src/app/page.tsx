import { Providers } from "@/components/Providers";
import { AuthContainer } from "@/components/AuthContainer";

export default function HomePage() {
  return (
    <main style={{ maxWidth: "860px", margin: "0 auto", padding: "3rem 1.5rem" }}>
      <header style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
          SIWE Session Authentication
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "1.05rem" }}>
          Road To Devcon - IV (Problem 2): &ldquo;Log In With a Wallet, Trust Only the Signature&rdquo;
        </p>
      </header>

      <Providers>
        <AuthContainer />
      </Providers>
    </main>
  );
}
