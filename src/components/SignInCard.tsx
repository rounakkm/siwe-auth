"use client";

import React, { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage, useChainId } from "wagmi";
import { SiweMessage } from "siwe";

interface SignInCardProps {
  onAuthSuccess: () => Promise<void>;
}

export function SignInCard({ onAuthSuccess }: SignInCardProps) {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectors, connect, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStep, setAuthStep] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shortenAddress = (addr?: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleSignIn = async () => {
    if (!address) {
      setErrorMessage("Please connect your wallet first.");
      return;
    }

    try {
      setIsAuthenticating(true);
      setErrorMessage(null);


      setAuthStep("Requesting nonce from server...");
      const nonceRes = await fetch("/api/auth/nonce");
      if (!nonceRes.ok) {
        throw new Error("Failed to obtain authentication nonce from server.");
      }
      const { nonce } = await nonceRes.json();
      if (!nonce) {
        throw new Error("Invalid nonce returned by server.");
      }

   
      setAuthStep("Constructing SIWE message...");
      const domain = window.location.host;
      const origin = window.location.origin;

      const siweMessage = new SiweMessage({
        domain,
        address,
        statement: "Sign in with Ethereum to the application.",
        uri: origin,
        version: "1",
        chainId: chainId || 1,
        nonce,
        issuedAt: new Date().toISOString(),
      });

      const preparedMessage = siweMessage.prepareMessage();

     
      setAuthStep("Please sign the message in your wallet...");
      const signature = await signMessageAsync({ message: preparedMessage });

      
      setAuthStep("Verifying signature on server...");
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: preparedMessage,
          signature,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.ok) {
        throw new Error(verifyData.error || "Authentication verification failed.");
      }

  
      setAuthStep("Finalizing session...");
      await onAuthSuccess();
    } catch (err: any) {
      console.error("SIWE sign-in error:", err);

      if (err.message?.includes("User rejected") || err.name === "UserRejectedRequestError") {
        setErrorMessage("Signature request was rejected in your wallet.");
      } else {
        setErrorMessage(err.message || "Failed to complete SIWE authentication.");
      }
    } finally {
      setIsAuthenticating(false);
      setAuthStep("");
    }
  };

  return (
    <div className="card" style={{ maxWidth: "560px", margin: "0 auto" }}>
      <h2 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>
        Wallet Authentication
      </h2>
      <p style={{ color: "var(--muted)", fontSize: "0.95rem", marginBottom: "1.5rem" }}>
        Sign in with Ethereum using a cryptographically verified signature and stateless encrypted session.
      </p>

      {errorMessage && (
        <div className="alert-error" role="alert">
          {errorMessage}
        </div>
      )}

      {connectError && (
        <div className="alert-error" role="alert">
          {connectError.message}
        </div>
      )}

      {!isConnected ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <p style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
            Connect your browser wallet to begin.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {connectors.length > 0 ? (
              connectors.map((connector) => (
                <button
                  key={connector.uid}
                  className="btn-primary"
                  onClick={() => connect({ connector })}
                  disabled={isConnecting}
                >
                  {isConnecting ? "Connecting..." : `Connect ${connector.name}`}
                </button>
              ))
            ) : (
              <button
                className="btn-primary"
                onClick={() => {
                  if (connectors[0]) connect({ connector: connectors[0] });
                }}
                disabled={isConnecting}
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem 1rem",
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              borderRadius: "6px",
              border: "1px solid var(--card-border)",
            }}
          >
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Connected Wallet</div>
              <div className="mono" style={{ fontWeight: 600 }}>
                {shortenAddress(address)}
              </div>
            </div>
            <button
              className="btn-secondary"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
              onClick={() => disconnect()}
              disabled={isAuthenticating}
            >
              Disconnect
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="badge badge-muted">Session: Unauthenticated</span>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              (Wallet connection alone is not sufficient)
            </span>
          </div>

          <button
            className="btn-primary"
            onClick={handleSignIn}
            disabled={isAuthenticating}
            style={{ padding: "0.75rem", fontSize: "1rem", marginTop: "0.5rem" }}
          >
            {isAuthenticating
              ? authStep || "Authenticating..."
              : "Sign-In with Ethereum (SIWE)"}
          </button>
        </div>
      )}
    </div>
  );
}
