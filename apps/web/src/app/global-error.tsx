"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: "16px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h2>Ocorreu um erro inesperado</h2>
          <p style={{ color: "#666", textAlign: "center", maxWidth: "400px" }}>
            Algo deu errado. Tente recarregar a p&aacute;gina.
          </p>
          {error.digest && (
            <p style={{ color: "#999", fontSize: "12px" }}>
              ID do erro: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
