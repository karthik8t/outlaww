import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"

import "./index.css"
import App from "./App.tsx"
import SessionsPage from "./pages/SessionsPage.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SessionsPage />} />
          <Route path="/session/:sessionId" element={<App />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)
