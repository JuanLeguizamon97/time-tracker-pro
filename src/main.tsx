import { createRoot } from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./config/msalConfig";
import App from "./App.tsx";
import "./index.css";

const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || "azure";

if (AUTH_MODE === "mock") {
  createRoot(document.getElementById("root")!).render(<App />);
} else {
  msalInstance.initialize().then(() => {
    msalInstance.handleRedirectPromise().then(() => {
      createRoot(document.getElementById("root")!).render(
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      );
    });
  });
}
