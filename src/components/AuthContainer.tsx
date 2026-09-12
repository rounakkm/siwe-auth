"use client";

import React, { useEffect, useState, useCallback } from "react";
import { SignInCard } from "./SignInCard";
import { SellerDashboard } from "./SellerDashboard";

interface SessionState {
  authenticated: boolean;
  address?: string;
  loading: boolean;
}

export function AuthContainer() {
  const [sessionState, setSessionState] = useState<SessionState>({
    authenticated: false,
    loading: true,
  });

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.address) {
          setSessionState({
            authenticated: true,
            address: data.address,
            loading: false,
          });
          return;
        }
      }
      setSessionState({
        authenticated: false,
        address: undefined,
        loading: false,
      });
    } catch {
      setSessionState({
        authenticated: false,
        address: undefined,
        loading: false,
      });
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (sessionState.loading) {
    return (
      <div className="card" style={{ maxWidth: "560px", margin: "2rem auto", textAlign: "center", padding: "2rem" }}>
        <p style={{ color: "var(--muted)" }}>Checking session status...</p>
      </div>
    );
  }

  if (sessionState.authenticated && sessionState.address) {
    return (
      <SellerDashboard
        authenticatedAddress={sessionState.address}
        onLogout={checkSession}
      />
    );
  }

  return <SignInCard onAuthSuccess={checkSession} />;
}
