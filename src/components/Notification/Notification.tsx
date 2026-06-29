import React, { useEffect, useState } from 'react';
import './Notification.css';

export interface NotificationProps {
    message: string;
    type?: 'success' | 'error' | 'info';
    duration?: number;
    onClose?: () => void;
}

export const Notification: React.FC<NotificationProps> = ({
    message,
    type = 'info',
    duration = 3000,
    onClose
}) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => {
                if (onClose) onClose();
            }, 300);
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            if (onClose) onClose();
        }, 300);
    };

    return (
        <div className={`notification notification-${type} ${isVisible ? 'visible' : ''}`}>
            <span className="notification-icon">
                {type === 'success' && '✓'}
                {type === 'error' && '✕'}
                {type === 'info' && 'ℹ'}
            </span>
            <span className="notification-message">{message}</span>
            <button className="notification-close" onClick={handleClose}>
                ×
            </button>
        </div>
    );
};

// Notification container to manage multiple notifications
export const NotificationContainer: React.FC = () => {
    const [notifications, setNotifications] = useState<Array<{
        id: number;
        message: string;
        type: 'success' | 'error' | 'info';
    }>>([]);

    const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
    };

    const removeNotification = (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    // Expose showNotification globally
    useEffect(() => {
        (window as any).showNotification = showNotification;
    }, []);

    return (
        <div className="notification-container">
            {notifications.map(notification => (
                <Notification
                    key={notification.id}
                    message={notification.message}
                    type={notification.type}
                    onClose={() => removeNotification(notification.id)}
                />
            ))}
        </div>
    );
};

// Helper function to show notifications
export const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if ((window as any).showNotification) {
        (window as any).showNotification(message, type);
    }
};
