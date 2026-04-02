import React from "react";

function ActionButtons({
  onImportClick,
  onVerifyClick,
  onRefreshClick,
  onSettingsClick,
}) {
  return (
    <div className="action-buttons">
      <button
        className="btn primary"
        data-testid="import-credential-button"
        onClick={onImportClick}
      >
        Import Credential
      </button>
      <button
        className="btn primary"
        data-testid="verify-credential-button"
        onClick={onVerifyClick}
      >
        Verify Credential
      </button>
      <button
        className="icon-action-btn"
        data-testid="refresh-button"
        aria-label="Refresh credentials"
        title="Refresh"
        onClick={onRefreshClick}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="action-icon" title="Refresh">
          <path d="M17.65 6.35A7.95 7.95 0 0012 4V1L7 6l5 5V7a5 5 0 11-4.9 6h-2.02A7 7 0 1017.65 6.35z" />
        </svg>
      </button>
      <button
        className="icon-action-btn"
        aria-label="Settings"
        title="Settings"
        onClick={onSettingsClick}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="action-icon" title="Settings">
          <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7.2 7.2 0 00-1.63-.94l-.36-2.54A.5.5 0 0013.9 2h-3.8a.5.5 0 00-.49.42l-.36 2.54c-.58.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 00-.6.22L2.71 8.48a.5.5 0 00.12.64l2.03 1.58c-.05.31-.08.63-.08.94s.03.63.08.94l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.23 1.13-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1112 8a3.5 3.5 0 010 7.5z" />
        </svg>
      </button>
    </div>
  );
}

export default ActionButtons;
