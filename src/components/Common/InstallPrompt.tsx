import React, { useEffect, useState } from 'react';
import './InstallPrompt.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already running as installed PWA — don't show banner
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    // Dismissed in this session
    if (sessionStorage.getItem('pwa-install-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setVisible(false);
      setInstalled(true);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
      setInstalled(true);
    }
    setPromptEvent(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  if (!visible || installed) return null;

  return (
    <div className="install-prompt" role="banner" aria-label="Install app prompt">
      <div className="install-prompt__icon">
        <img src="/FullLogo.png" alt="AydQuoteMaker" />
      </div>
      <div className="install-prompt__text">
        <strong>Install AydQuoteMaker</strong>
        <span>Add to your home screen for faster access — works offline too.</span>
      </div>
      <div className="install-prompt__actions">
        <button className="install-prompt__btn install-prompt__btn--primary" onClick={handleInstall}>
          Install
        </button>
        <button className="install-prompt__btn install-prompt__btn--dismiss" onClick={handleDismiss} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}
