import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/popup/App";
import "../../src/styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing popup root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
