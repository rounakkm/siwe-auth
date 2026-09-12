"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { SellerListing, SellerPayout } from "@/data/sellers";

interface SellerDashboardProps {
  authenticatedAddress: string;
  onLogout: () => Promise<void>;
}

export function SellerDashboard({
  authenticatedAddress,
  onLogout,
}: SellerDashboardProps) {
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [payout, setPayout] = useState<SellerPayout | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSellerData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);


      const [listingsRes, payoutRes] = await Promise.all([
        fetch("/api/seller/listings"),
        fetch("/api/seller/payout"),
      ]);

      if (!listingsRes.ok) {
        const data = await listingsRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load seller listings");
      }

      if (!payoutRes.ok) {
        const data = await payoutRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load seller payout info");
      }

      const listingsData = await listingsRes.json();
      const payoutData = await payoutRes.json();

      setListings(listingsData.listings || []);
      setPayout(payoutData.payout || null);
    } catch (err: any) {
      console.error("Seller dashboard fetch error:", err);
      setError(err.message || "Failed to load seller dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSellerData();
  }, [fetchSellerData]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      await onLogout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      {/* Session Header */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span className="badge badge-success">● Session Authenticated</span>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>via Iron-Session & SIWE</span>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Authenticated Address:</div>
          <div className="mono" style={{ fontSize: "1.05rem", fontWeight: 600, wordBreak: "break-all" }}>
            {authenticatedAddress}
          </div>
        </div>
        <button
          className="btn-danger"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? "Logging out..." : "Log Out"}
        </button>
      </div>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--muted)" }}>Loading seller dashboard data...</p>
        </div>
      ) : (
        <>
          {/* Payout Information Section */}
          <div className="card">
            <h3 style={{ fontSize: "1.15rem", marginBottom: "1rem" }}>
              Payout Information
            </h3>
            {payout ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    backgroundColor: "rgba(15, 23, 42, 0.5)",
                    padding: "1rem",
                    borderRadius: "6px",
                    border: "1px solid var(--card-border)",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    Pending Balance
                  </div>
                  <div
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      color: "var(--accent)",
                      marginTop: "0.25rem",
                    }}
                  >
                    {formatCurrency(payout.pendingCents)}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "rgba(15, 23, 42, 0.5)",
                    padding: "1rem",
                    borderRadius: "6px",
                    border: "1px solid var(--card-border)",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    Payout Destination
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      marginTop: "0.25rem",
                      wordBreak: "break-all",
                    }}
                  >
                    {payout.payoutAddress}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "rgba(15, 23, 42, 0.5)",
                    padding: "1rem",
                    borderRadius: "6px",
                    border: "1px solid var(--card-border)",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    Next Scheduled Payout
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 500, marginTop: "0.25rem" }}>
                    {new Date(payout.nextScheduledDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--muted)" }}>No payout information available.</p>
            )}
          </div>

          {/* Seller Listings Section */}
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h3 style={{ fontSize: "1.15rem" }}>Seller Listings</h3>
              <span className="badge badge-muted">{listings.length} item{listings.length === 1 ? "" : "s"}</span>
            </div>

            {listings.length === 0 ? (
              <p style={{ color: "var(--muted)", padding: "1rem 0" }}>
                No active listings found for this seller.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {listings.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "1rem",
                      backgroundColor: "rgba(15, 23, 42, 0.5)",
                      borderRadius: "6px",
                      border: "1px solid var(--card-border)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                        {item.description}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.4rem" }}>
                        Listed: {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "1.2rem",
                        fontWeight: 700,
                        color: "var(--foreground)",
                        marginLeft: "1rem",
                      }}
                    >
                      {formatCurrency(item.priceCents)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
