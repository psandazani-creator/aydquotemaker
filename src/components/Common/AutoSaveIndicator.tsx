import React from 'react';
import { AutoSaveStatus } from '../../hooks/useAutoSave';
import './AutoSaveIndicator.css';

interface Props {
  status: AutoSaveStatus;
  savedAt: Date | null;
}

export function AutoSaveIndicator({ status, savedAt }: Props) {
  if (status === 'idle') return null;

  const timeStr = savedAt
    ? savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <span className={`autosave-indicator autosave-${status}`} aria-live="polite">
      {status === 'pending' && (
        <>
          <span className="autosave-dot autosave-dot--pulse" />
          Unsaved changes
        </>
      )}
      {status === 'saving' && (
        <>
          <span className="autosave-spinner" />
          Saving draft...
        </>
      )}
      {status === 'saved' && (
        <>
          <i className="fas fa-check-circle" />
          {timeStr ? `Draft saved at ${timeStr}` : 'Draft saved'}
        </>
      )}
      {status === 'error' && (
        <>
          <i className="fas fa-exclamation-circle" />
          Auto-save failed
        </>
      )}
    </span>
  );
}
