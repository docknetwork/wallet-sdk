import React from "react";
import { Box, Modal, TextField, CircularProgress } from "@mui/material";

function ImportCredentialModal({
  open,
  isImporting,
  credentialUrl,
  onCredentialUrlChange,
  onImport,
  onClose,
  modalStyle,
}) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (isImporting) {
          return;
        }
        onClose();
      }}
    >
      <Box sx={modalStyle}>
        {isImporting ? (
          <div className="verify-loading-state">
            <CircularProgress size={32} />
            <p>Importing credential offer and processing response...</p>
          </div>
        ) : (
          <>
            <h2>Import Credential</h2>
            <div className="form-group">
              <label htmlFor="credentialUrl">Credential Offer URL:</label>
              <TextField
                id="credentialUrl"
                fullWidth
                value={credentialUrl}
                onChange={(e) => onCredentialUrlChange(e.target.value)}
                placeholder="Enter credential offer URL"
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
                onClick={onImport}
                disabled={!credentialUrl}
              >
                Import
              </button>
            </div>
          </>
        )}
      </Box>
    </Modal>
  );
}

export default ImportCredentialModal;
