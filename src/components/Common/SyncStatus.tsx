import React, { useEffect, useState } from "react";
import {
  subscribeSyncStatus,
  getSyncStatus,
  syncNow,
  type SyncStatus as SyncStatusValue,
} from "../../db/syncManager";
import "./SyncStatus.css";

export function SyncStatus() {
  const [status, setStatus] = useState<SyncStatusValue>(getSyncStatus());

  useEffect(() => subscribeSyncStatus(setStatus), []);

  const onClick = () => void syncNow();

  if (status.state === "offline") {
    const pending = status.pendingCount
      ? ` (${status.pendingCount} pending)`
      : "";
    return (
      <span
        className="sync-badge sync-offline"
        title={`Working offline — changes will sync when you're back online${pending}`}
      >
        <i className="fas fa-wifi-slash" />
        Offline{pending}
      </span>
    );
  }

  if (status.state === "syncing") {
    return (
      <span className="sync-badge sync-syncing" title="Syncing changes...">
        <span className="sync-spinner" />
        Syncing
      </span>
    );
  }

  if (status.state === "error") {
    return (
      <span
        className="sync-badge sync-offline"
        title={status.error ?? "Sync error — tap to retry"}
        onClick={onClick}
        role="button"
        style={{ cursor: "pointer" }}
      >
        <i className="fas fa-triangle-exclamation" />
        Retry sync
      </span>
    );
  }

  const lastSynced = status.lastSyncedAt;
  const tooltip = lastSynced
    ? `Last synced: ${lastSynced.toLocaleTimeString()} — tap to sync now`
    : "Tap to sync now";

  return (
    <span
      className="sync-badge sync-synced"
      title={tooltip}
      onClick={onClick}
      role="button"
      style={{ cursor: "pointer" }}
    >
      <i className="fas fa-check-circle" />
      Synced
    </span>
  );
}
