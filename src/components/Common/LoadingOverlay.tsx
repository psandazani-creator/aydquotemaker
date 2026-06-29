// src/components/Common/LoadingOverlay.tsx
import React from 'react';
import './LoadingOverlay.css';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

export function LoadingOverlay({ isVisible, message = 'Saving...' }: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-backdrop"></div>
      <div className="loading-content">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
        <div className="loading-message">{message}</div>
      </div>
    </div>
  );
}
