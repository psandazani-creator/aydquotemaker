import React, { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './UpdatePrompt.css';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss "offline ready" toast after 4 seconds
  useEffect(() => {
    if (offlineReady) {
      offlineTimer.current = setTimeout(() => setOfflineReady(false), 4000);
    }
    return () => {
      if (offlineTimer.current) clearTimeout(offlineTimer.current);
    };
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className={`update-prompt ${needRefresh ? 'update-prompt--update' : 'update-prompt--ready'}`} role="status">
      <span className="update-prompt__icon">
        {needRefresh ? '🔄' : '✅'}
      </span>
      <span className="update-prompt__message">
        {needRefresh
          ? 'New version available'
          : 'App ready — works offline'}
      </span>
      {needRefresh && (
        <button
          className="update-prompt__btn update-prompt__btn--refresh"
          onClick={() => updateServiceWorker(true)}
        >
          Refresh
        </button>
      )}
      <button
        className="update-prompt__btn update-prompt__btn--close"
        aria-label="Dismiss"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        ✕
      </button>
    </div>
  );
}
