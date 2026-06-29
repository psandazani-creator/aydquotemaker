// src/components/Auth/Loader.tsx
import React from 'react';
import './Loader.css';

interface LoaderProps {
  isVisible: boolean;
  message?: string;
}

export function Loader({ isVisible, message = 'Authenticating...' }: LoaderProps) {
  if (!isVisible) return null;

  return (
    <div className="loader-overlay">
      <div className="loader-content">
        <div className="loader-spinner"></div>
        <p className="loader-message">{message}</p>
      </div>
    </div>
  );
}
