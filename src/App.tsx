// src/App.tsx
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import { Drawer } from "./components/Drawer/Drawer";
import { QuotationsPage } from "./components/Quotations/QuotationsPage";
import { QuoteForm } from "./components/Quotations/QuoteForm";
import { QuotePreview } from "./components/Quotations/QuotePreview";
import { SettingsPage } from "./components/Settings/SettingsPage";
import { ProfilePage } from "./components/Profile/Profile";
import { HelpPage } from "./components/Help/Help";
import { ContractsPage } from "./components/Contracts/ContractsPage";
import { InvoicesPage } from "./components/Invoices/InvoicesPage";
import { InvoiceForm } from "./components/Invoices/InvoiceForm";
import { Login } from "./components/Auth/Login";
import { PasswordReset } from "./components/Auth/PasswordReset";
import { Onboarding } from "./components/Onboarding/Onboarding";
import {
  NotificationContainer,
  showNotification,
} from "./components/Notification/Notification";
import { SyncStatus } from "./components/Common/SyncStatus";
import { InstallPrompt } from "./components/Common/InstallPrompt";
import { UpdatePrompt } from "./components/Common/UpdatePrompt";
import { Quote, DraftQuote } from "./types";
import { useQuotes } from "./hooks/useQuotes";
import "./styles/global.css";

function AppContent() {
  const { user, drawerOpen, setDrawerOpen, setCurrentQuote, login, logout } =
    useApp();
  const { clearAllDrafts } = useQuotes(user?.id);
  const [showPreview, setShowPreview] = useState(false);
  const [previewQuote, setPreviewQuote] = useState<DraftQuote | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    return (
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  // Apply theme
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleCreateQuote = () => {
    setCurrentQuote(null);
  };

  const handleSaveQuote = (quote: Quote | DraftQuote) => {
    console.log("Saving quote:", quote);
  };

  const handlePreview = (quote: DraftQuote) => {
    setPreviewQuote(quote);
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewQuote(null);
  };

  const handleExportQuotes = () => {
    showNotification("Export feature coming soon!", "info");
  };

  const handleClearDrafts = async () => {
    if (
      window.confirm(
        "Are you sure you want to clear all draft quotes? This action cannot be undone.",
      )
    ) {
      try {
        await clearAllDrafts();
        showNotification(
          "All drafts have been cleared successfully!",
          "success",
        );
      } catch (error) {
        console.error("Error clearing drafts:", error);
        showNotification("Failed to clear drafts. Please try again.", "error");
      }
    }
  };

  const handleSignOut = async () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      try {
        if (logout) {
          await logout();
        }
      } catch (error) {
        console.error("Error signing out:", error);
        showNotification("Failed to sign out. Please try again.", "error");
      }
    }
  };

  const [onboardingDone, setOnboardingDone] = React.useState(true);

  useEffect(() => {
    if (user) {
      const done = !!localStorage.getItem(`onboarding-${user.id}`);
      setOnboardingDone(done);
    }
  }, [user?.id]);

  if (window.location.pathname === "/reset-password") {
    return (
      <PasswordReset
        onDone={() => {
          window.history.replaceState(null, "", "/");
        }}
      />
    );
  }

  // If an admin Google OAuth callback lands here (Supabase ignores the /admin-zw
  // redirectTo when it's not whitelisted and falls back to the site root), forward
  // the full hash to the admin dashboard so it can process the tokens.
  if (
    window.location.hash.includes("access_token") &&
    sessionStorage.getItem("admin_oauth_pending") === "1"
  ) {
    sessionStorage.removeItem("admin_oauth_pending");
    window.location.replace("/admin-zw" + window.location.hash);
    return null;
  }

  if (!user) {
    return <Login onLogin={() => {}} />;
  }

  // Admin accounts belong to the admin dashboard — redirect them out of the main app
  if (user.isAdmin) {
    window.location.replace("/admin-zw");
    return null;
  }

  if (!onboardingDone) {
    return <Onboarding onComplete={() => setOnboardingDone(true)} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <button className="menu-btn" onClick={() => setDrawerOpen(true)}>
          ☰
        </button>
        <h1>AydQuoteMaker</h1>
        <div className="header-actions">
          <SyncStatus />

          <div className="header-action-buttons">
            <button
              className="header-action-btn theme-toggle"
              onClick={toggleTheme}
              data-tooltip={isDarkMode ? "Light Mode" : "Dark Mode"}
            >
              <i className={`fas ${isDarkMode ? "fa-sun" : "fa-moon"}`}></i>
            </button>
            <button
              className="header-action-btn sign-out"
              onClick={handleSignOut}
              data-tooltip="Sign Out"
            >
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </header>

      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main className="main-content">
        <Routes>
          <Route path="/" element={<QuotationsPage />} />
          <Route path="/quotations" element={<QuotationsPage />} />
          <Route path="/create-quote" element={<QuoteForm />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoice" element={<InvoicesPage />} />
          <Route path="/create-invoice" element={<InvoiceForm />} />
          <Route path="/contracts" element={<ContractsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </main>

      {showPreview && previewQuote && (
        <QuotePreview quote={previewQuote} onClose={closePreview} />
      )}

      <style>{`
        /* App-specific styles that work with global CSS */
        .app {
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .app-header {
          background: var(--bg-card);
          border-bottom: 1px solid var(--border-light);
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
          transition: all 0.3s ease;
        }

        .menu-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--text-primary);
          padding: 8px;
          border-radius: 8px;
          transition: all 0.3s ease;
        }

        .menu-btn:hover {
          background: var(--bg-elevated);
          box-shadow: var(--shadow-card);
        }

        .app-header h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          background: var(--gradient-gold);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          transition: all 0.3s ease;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .tier-indicator {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .tier-indicator.online {
          background: var(--success);
          color: white;
          box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
        }

        .tier-indicator.offline {
          background: var(--error);
          color: white;
          box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
        }

        .header-action-buttons {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .header-action-btn {
          position: relative;
          background: var(--bg-elevated);
          border: 1px solid var(--border-light);
          color: var(--text-primary);
          width: 36px;
          height: 36px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          font-size: 16px;
        }

        .header-action-btn:hover {
          background: var(--bg-secondary);
          transform: translateY(-2px);
          box-shadow: var(--shadow-card);
        }

        .header-action-btn.sign-out:hover {
          background: var(--error);
          border-color: var(--error);
          color: white;
          box-shadow: var(--shadow-gold);
        }

        .header-action-btn.theme-toggle:hover {
          background: var(--gradient-gold);
          color: var(--color-black);
          box-shadow: var(--shadow-gold);
        }

        /* Tooltip styles */
        .header-action-btn[data-tooltip] {
          position: relative;
        }

        .header-action-btn[data-tooltip]::before {
          content: attr(data-tooltip);
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 12px;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          border-radius: 6px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
          margin-top: 8px;
          z-index: 1000;
        }

        .header-action-btn[data-tooltip]::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 5px;
          border-style: solid;
          border-color: transparent transparent rgba(0, 0, 0, 0.9) transparent;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
          margin-top: 2px;
        }

        .header-action-btn[data-tooltip]:hover::before,
        .header-action-btn[data-tooltip]:hover::after {
          opacity: 1;
        }

        .main-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          transition: all 0.3s ease;
        }

        @media (max-width: 768px) {
          .app-header {
            padding: 12px 16px;
          }
          
          .app-header h1 {
            font-size: 16px;
          }
          
          .header-action-buttons {
            gap: 4px;
          }
          
          .header-action-btn {
            width: 32px;
            height: 32px;
            font-size: 14px;
          }
          
          .main-content {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <Router>
        <AppContent />
        <NotificationContainer />
        <InstallPrompt />
        <UpdatePrompt />
      </Router>
    </AppProvider>
  );
}

export default App;
