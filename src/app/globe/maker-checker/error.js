"use client";

import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ padding: "40px", color: "red", background: "white", width: "100%", height: "100%" }}>
      <h2>Something went wrong in Maker Checker!</h2>
      <pre style={{ whiteSpace: "pre-wrap", background: "#f1f1f1", padding: "20px" }}>{error.message}</pre>
      <pre style={{ whiteSpace: "pre-wrap", background: "#f1f1f1", padding: "20px" }}>{error.stack}</pre>
      <button onClick={() => reset()} style={{ padding: "10px", background: "black", color: "white" }}>Try again</button>
    </div>
  );
}
