import React from "react";
import CredentialCard from "./CredentialCard";

function CredentialsSection({
  formattedCredentials,
  documents,
  deletingCredentialId,
  onDeleteCredential,
}) {
  return (
    <div className="credentials-section">
      <h3>Credentials ({formattedCredentials.length})</h3>

      {formattedCredentials.length === 0 ? (
        <div className="no-credentials">
          No credentials found. Import some credentials to get started.
        </div>
      ) : (
        <div className="credentials-list">
          {formattedCredentials.map((document, idx) => (
            <CredentialCard
              key={document.id}
              document={document}
              rawDocument={documents[idx] || document}
              onDelete={onDeleteCredential}
              deleting={deletingCredentialId === document.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CredentialsSection;
