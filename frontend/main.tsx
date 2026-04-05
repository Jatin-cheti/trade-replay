import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.tsx";
import { frontendEnv } from "./lib/env";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";

const fallbackGoogleClientId = "519388948862-jgnq690fvh4ipig0ujcagbv671b8uvqh.apps.googleusercontent.com";
const googleClientId = frontendEnv.GOOGLE_CLIENT_ID || fallbackGoogleClientId;

if (!googleClientId) {
  // This warning helps catch OAuth setup issues in local runs quickly.
  console.warn("Google OAuth client_id is missing. Check VITE_* env variables.");
}

createRoot(document.getElementById("root")!).render(
	<GoogleOAuthProvider clientId={googleClientId}>
	       <ThemeProvider>
		       <App />
	       </ThemeProvider>
	</GoogleOAuthProvider>,
);
