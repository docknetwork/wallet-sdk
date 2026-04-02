import React from "react";
import { Box, Modal, TextField, CircularProgress } from "@mui/material";
import CredentialCard from "./CredentialCard";

function VerifyCredentialModal({
  open,
  isVerifying,
  verifyStep,
  proofRequestUrl,
  loadingMatchingCredentials,
  matchingCredentials,
  selectedCredential,
  onProofRequestUrlChange,
  onLoadMatchingCredentials,
  onVerifyCredential,
  onBackStep,
  onClose,
  onSelectCredential,
  modalStyle,
}) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (isVerifying) {
          return;
        }
        onClose();
      }}
    >
      <Box sx={modalStyle}>
        {isVerifying ? (
          <div className="verify-loading-state">
            <CircularProgress size={32} />
            <p>Checking credential and submitting verification...</p>
          </div>
        ) : (
          <>
            {verifyStep === 1 && (
              <>
                <h2>Verify Credential</h2>
                <div className="form-group">
                  <label htmlFor="proofRequestUrl">Proof Request URL:</label>
                  <TextField
                    id="proofRequestUrl"
                    fullWidth
                    value={proofRequestUrl}
                    onChange={(e) => onProofRequestUrlChange(e.target.value)}
                    placeholder="Enter proof request URL"
                    InputProps={{
                      sx: {
                        borderRadius: '8px',
                        '&.Mui-focused': {
                          boxShadow: '0 0 0 3px rgba(76, 81, 191, 0.1)',
                        },
                      },
                    }}
                  />
                </div>
                <div className="modal-buttons">
                  <button
                    className="btn secondary"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn primary"
                    onClick={onLoadMatchingCredentials}
                    disabled={!proofRequestUrl || loadingMatchingCredentials}
                  >
                    {loadingMatchingCredentials ? 'Loading...' : 'Next'}
                  </button>
                </div>
              </>
            )}
            {verifyStep === 2 && (
              <>
                <h2>Select Credential to Present</h2>
                {matchingCredentials.length === 0 ? (
                  <div className="no-credentials">
                    No matching credentials found for this proof request.
                  </div>
                ) : (
                  <div className="credential-selection">
                    {matchingCredentials.map((item) => (
                      <CredentialCard
                        key={item.document.id}
                        document={item.document}
                        rawDocument={item.rawDocument || item.document}
                        selectable
                        selected={selectedCredential?.id === item.rawDocument?.id}
                        onClick={() => onSelectCredential(item.rawDocument)}
                      />
                    ))}
                  </div>
                )}
                <div className="modal-buttons">
                  <button
                    className="btn secondary"
                    onClick={onBackStep}
                  >
                    Back
                  </button>
                  <button
                    className="btn primary"
                    onClick={onVerifyCredential}
                    disabled={!selectedCredential}
                  >
                    Verify
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </Box>
    </Modal>
  );
}

export default VerifyCredentialModal;
