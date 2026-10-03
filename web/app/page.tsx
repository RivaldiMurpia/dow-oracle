export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        background: "#0a0a0f",
        color: "#e8e8ef",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <div style={{ fontSize: "3rem" }}>🔮</div>
      <h1 style={{ fontSize: "2.5rem", margin: 0, letterSpacing: "-0.02em" }}>
        DOWOracle
      </h1>
      <p style={{ maxWidth: "34rem", color: "#9a9ab0", lineHeight: 1.6 }}>
        AI crypto research agent — give it a topic, it digs through fresh
        news, forums and threads, then returns a signal report with
        citations. Dashboard under construction.
      </p>
      <p style={{ fontSize: "0.85rem", color: "#55556a" }}>
        NVIDIA Nemotron on Nebius Token Factory · grounded with Tavily
      </p>
    </main>
  );
}
