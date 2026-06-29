// src/components/Auth/GoldBoxSpinner.tsx
import React from 'react';
import './GoldBoxSpinner.css';

interface GoldBoxSpinnerProps {
  text?: string;
}

export const GoldBoxSpinner: React.FC<GoldBoxSpinnerProps> = ({
  text = "Authenticating..."
}) => {
  return (
    <div className="gold-box-spinner-overlay">
      <div className="gold-box-spinner-container">
        <div className="gold-boxes">
          <div className="gold-box box-1"></div>
          <div className="gold-box box-2"></div>
          <div className="gold-box box-3"></div>
          <div className="gold-box box-4"></div>
        </div>
        <p className="spinner-text">{text}</p>
      </div>
    </div>
  );
};