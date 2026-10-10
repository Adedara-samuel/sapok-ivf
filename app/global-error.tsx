"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-NG">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          background: "#F7FAFA",
          color: "#0F1F20",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#5B6B6D", marginBottom: 16 }}>
            The app hit an unexpected error. Your demo data is safe in this browser.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#0F766E",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
