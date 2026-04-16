import React from "react";
import { FormControlLabel, Switch } from "@mui/material";

function FetchMessagesIcon({ className, title }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} title={title}>
      <path d="M20 8h-3V4H7v4H4l8 8 8-8zm-2 10H6v-3H4v5h16v-5h-2v3z" />
    </svg>
  );
}

function DidSection({
  defaultDID,
  walletProfiles,
  activeWalletId,
  autoCheckMessages,
  onProvisionNewWallet,
  onSwitchWallet,
  onFetchMessages,
  onAutoCheckToggle,
}) {
  return (
    <div className="did-section">
      {!defaultDID ? (
        <div className="create-did">
          <button
            className="btn primary"
            onClick={() => onProvisionNewWallet()}
          >
            Create Default DID
          </button>
        </div>
      ) : (
        <div className="did-display">
          <div className="did-info">
            <div className="did-wallet-switcher">
              <label htmlFor="did-wallet-selector" className="did-wallet-switcher-label">Wallet</label>
              <select
                id="did-wallet-selector"
                className="did-wallet-selector"
                data-testid="wallet-selector-dropdown"
                value={activeWalletId || ''}
                onChange={(event) => onSwitchWallet(event.target.value)}
                disabled={walletProfiles.length <= 1}
              >
                {walletProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="did-value">{defaultDID}</span>
            <div className="did-controls">
              <div className="did-control-group did-copy-group">
                <button
                  className="did-icon-btn"
                  data-testid="copy-did-button"
                  aria-label="Copy DID"
                  title="Copy DID"
                  onClick={() => {
                    navigator.clipboard.writeText(defaultDID);
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="did-action-icon" title="Copy DID">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                  </svg>
                </button>
              </div>
              <div className="did-control-group did-messages-group">
                <button
                  className="did-icon-btn"
                  data-testid="fetch-messages-button"
                  aria-label="Fetch Messages"
                  title="Fetch Messages"
                  onClick={() => {
                    void onFetchMessages();
                  }}
                >
                  <FetchMessagesIcon
                    className="did-action-icon"
                    title="Fetch Messages"
                  />
                </button>
                <FormControlLabel
                  className="did-auto-check-toggle"
                  control={(
                    <Switch
                      size="small"
                      checked={autoCheckMessages}
                      onChange={(event) => onAutoCheckToggle(event.target.checked)}
                    />
                  )}
                  label="Auto-check every 30s"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DidSection;
