import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { MarketDataProvider } from "./market/MarketDataContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MarketDataProvider><App /></MarketDataProvider>
  </StrictMode>
);
