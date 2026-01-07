import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import ReactQueryProvider from "./providers/ReactQueryProvider";
import { MeloProvider } from "./components/melo/MeloProvider";
import { ContextMenuProvider } from "./contexts/ContextMenuContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ReactQueryProvider>
        <MeloProvider>
          <ContextMenuProvider>
            <App />
          </ContextMenuProvider>
        </MeloProvider>
      </ReactQueryProvider>
    </AuthProvider>
  </React.StrictMode>
);
