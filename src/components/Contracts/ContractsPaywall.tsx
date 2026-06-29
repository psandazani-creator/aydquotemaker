// src/components/Contracts/ContractsPaywall.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ContractsPaywallProps {
  onClose?: () => void;
}

export const ContractsPaywall: React.FC<ContractsPaywallProps> = ({ onClose }) => {
  const navigate = useNavigate();

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    navigate('/quotations');
  };

  return (
    <div className="contracts-paywall">
      <div className="paywall-container">
        <div className="paywall-header">
          <div className="paywall-icon">
            <span>📄</span>
          </div>
          <button className="close-btn" onClick={handleClose}>
            ×
          </button>
        </div>

        <h2>Contract Generator</h2>

        <p className="paywall-description">
          AI-powered templates for service agreements, NDAs & more.
        </p>

        <div className="feature-list">
          <div className="feature-item">
            <span className="feature-icon">✓</span>
            <span>Unlimited contracts</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✓</span>
            <span>Digital signatures</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✓</span>
            <span>PDF export & storage</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✓</span>
            <span>Track status & history</span>
          </div>
        </div>

        <div className="payment-instruction">
          <p>💰 Send Ecocash payment to:</p>
          <div className="phone-number">0771 926 832</div>
        </div>

        <button className="btn-purchase">
          🔓 I've made payment
        </button>

        <div className="paywall-footer">
          <p>Questions? <a href="#help">0771 926 832 (call/WhatsApp)</a></p>
        </div>
      </div>

      <style>{`
        .contracts-paywall {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
          padding: 16px;
        }

        .paywall-container {
          background: var(--bg-card);
          border-radius: 20px;
          padding: 20px 24px 24px 24px;
          max-width: 400px;
          width: 100%;
          text-align: center;
          position: relative;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-height: 90vh;
          overflow-y: auto;
        }

        /* Hide scrollbar but keep functionality */
        .paywall-container::-webkit-scrollbar {
          width: 4px;
        }

        .paywall-container::-webkit-scrollbar-track {
          background: var(--bg-elevated);
          border-radius: 10px;
        }

        .paywall-container::-webkit-scrollbar-thumb {
          background: var(--primary-gold);
          border-radius: 10px;
        }

        .paywall-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .paywall-icon {
          font-size: 40px;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 28px;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: all 0.2s ease;
          margin: -8px -8px 0 0;
        }

        .close-btn:hover {
          background: var(--bg-elevated);
          color: var(--text-primary);
        }

        .paywall-container h2 {
          font-size: 22px;
          margin-bottom: 8px;
          color: var(--text-primary);
        }

        .paywall-description {
          color: var(--text-secondary);
          margin-bottom: 20px;
          line-height: 1.4;
          font-size: 13px;
        }

        .feature-list {
          text-align: left;
          margin-bottom: 20px;
          background: var(--bg-elevated);
          border-radius: 12px;
          padding: 12px 16px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 4px 12px;
        }

        .feature-item {
          display: flex;
          align-items: center;
          padding: 4px 0;
          color: var(--text-primary);
          font-size: 12px;
        }

        .feature-icon {
          color: var(--primary-gold);
          font-weight: bold;
          margin-right: 8px;
          font-size: 14px;
          flex-shrink: 0;
        }

        .payment-instruction {
          background: var(--bg-elevated);
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 20px;
          border: 1px solid var(--primary-gold);
        }

        .payment-instruction p {
          margin: 0 0 6px 0;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .phone-number {
          font-size: 26px;
          font-weight: bold;
          color: var(--primary-gold);
          letter-spacing: 1px;
          word-break: keep-all;
        }

        .btn-purchase {
          width: 100%;
          padding: 12px 20px;
          font-size: 15px;
          font-weight: 600;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          background: var(--primary-gold);
          color: white;
          transition: all 0.2s ease;
          margin-bottom: 16px;
        }

        .btn-purchase:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(200, 160, 40, 0.3);
        }

        .btn-purchase:active {
          transform: translateY(0);
        }

        .paywall-footer {
          font-size: 11px;
          color: var(--text-secondary);
          border-top: 1px solid var(--border-light);
          padding-top: 12px;
        }

        .paywall-footer a {
          color: var(--primary-gold);
          text-decoration: none;
        }

        /* Responsive styles for very small screens */
        @media (max-width: 480px) {
          .paywall-container {
            padding: 16px 20px 20px 20px;
            max-width: 100%;
          }

          .paywall-icon {
            font-size: 32px;
          }

          .paywall-container h2 {
            font-size: 20px;
          }

          .paywall-description {
            font-size: 12px;
            margin-bottom: 16px;
          }

          .feature-list {
            padding: 10px 12px;
            margin-bottom: 16px;
            gap: 2px 8px;
          }

          .feature-item {
            font-size: 11px;
          }

          .phone-number {
            font-size: 22px;
          }

          .btn-purchase {
            padding: 10px 16px;
            font-size: 14px;
          }
        }

        @media (max-width: 360px) {
          .feature-list {
            grid-template-columns: 1fr;
            gap: 2px;
          }
          
          .feature-item {
            padding: 2px 0;
          }
        }

        @media (min-width: 768px) {
          .paywall-container {
            max-width: 420px;
          }
        }

        @media (min-width: 1024px) {
          .paywall-container {
            max-width: 440px;
          }
        }

        /* Landscape mode on phones */
        @media (max-height: 600px) and (orientation: landscape) {
          .paywall-container {
            padding: 12px 20px;
            max-height: 95vh;
          }
          
          .paywall-icon {
            font-size: 28px;
          }
          
          .feature-list {
            margin-bottom: 12px;
            padding: 8px 12px;
          }
          
          .payment-instruction {
            margin-bottom: 12px;
            padding: 8px;
          }
          
          .phone-number {
            font-size: 20px;
          }
          
          .btn-purchase {
            margin-bottom: 10px;
            padding: 8px 16px;
          }
        }
      `}</style>
    </div>
  );
};