import React, { useState } from "react";

function humanizeKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatDate(value) {
  if (!value) return null;
  const clean = String(value).replace(/^"|"$/g, '').trim();
  try {
    const d = new Date(clean);
    if (!isNaN(d)) return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (_) {}
  return clean;
}

function formatAttributeValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(formatAttributeValue).join(', ');
  if (typeof value === 'object') {
    // Prefer a human-readable scalar property over raw JSON
    const pick = value.name ?? value.value ?? value.id ?? value.label;
    if (pick !== undefined && typeof pick !== 'object') return String(pick);
    // Single-key object — just show its value
    const entries = Object.entries(value);
    if (entries.length === 1) return formatAttributeValue(entries[0][1]);
    // Multi-key: show "Key: Value" pairs joined by space
    return entries.map(([k, v]) => `${humanizeKey(k)}: ${formatAttributeValue(v)}`).join(' · ');
  }
  if (typeof value === 'string') {
    const stripped = value.replace(/^"|"$/g, '');
    if (/^\d{4}-\d{2}-\d{2}/.test(stripped)) {
      try {
        return new Date(stripped).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      } catch (_) {}
    }
    return stripped;
  }
  return String(value);
}

function isPrimitiveValue(value) {
  return value === null || value === undefined || typeof value !== 'object';
}

function AttributeNode({ label, value, depth = 0 }) {
  const normalizedLabel = label ? humanizeKey(label) : null;

  if (Array.isArray(value)) {
    if (value.length === 0 || value.every(isPrimitiveValue)) {
      return (
        <div className="credential-attribute-row">
          <span className="attribute-label">{normalizedLabel}</span>
          <span className="attribute-value">{formatAttributeValue(value)}</span>
        </div>
      );
    }

    return (
      <div className={`attribute-group depth-${depth}`}>
        {normalizedLabel && <div className="attribute-group-title">{normalizedLabel}</div>}
        <div className="attribute-group-body">
          {value.map((item, index) => (
            <AttributeNode
              key={`${normalizedLabel || 'item'}-${index}`}
              label={`Item ${index + 1}`}
              value={item}
              depth={depth + 1}
            />
          ))}
        </div>
      </div>
    );
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([key]) => key !== 'id');

    if (entries.length === 0) {
      return (
        <div className="credential-attribute-row">
          <span className="attribute-label">{normalizedLabel}</span>
          <span className="attribute-value">—</span>
        </div>
      );
    }

    return (
      <div className={`attribute-group depth-${depth}`}>
        {normalizedLabel && <div className="attribute-group-title">{normalizedLabel}</div>}
        <div className="attribute-group-body">
          {entries.map(([key, nestedValue]) => (
            <AttributeNode
              key={`${normalizedLabel || 'group'}-${key}`}
              label={key}
              value={nestedValue}
              depth={depth + 1}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="credential-attribute-row">
      <span className="attribute-label">{normalizedLabel}</span>
      <span className="attribute-value">{formatAttributeValue(value)}</span>
    </div>
  );
}

function CredentialCard({ document, rawDocument, selectable, selected, onClick, onDelete, deleting }) {
  const [expanded, setExpanded] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const subject = document?.credentialSubject || {};
  const subjectEntries = Object.entries(subject).filter(([key]) => key !== 'id');
  const PREVIEW_COUNT = 4;
  const visibleEntries = expanded ? subjectEntries : subjectEntries.slice(0, PREVIEW_COUNT);
  const hasMore = subjectEntries.length > PREVIEW_COUNT;

  const issuer = document?.issuer;
  const issuerName = typeof issuer === 'string'
    ? issuer
    : issuer?.name || issuer?.id || null;
  const issuerLogo = typeof issuer === 'object'
    ? (issuer?.image?.id || issuer?.image || issuer?.logo?.id || issuer?.logo || null)
    : null;
  const issuerLogoUrl = typeof issuerLogo === 'string' ? issuerLogo : null;

  const issuanceDate = formatDate(document?.issuanceDate);
  const expirationDate = formatDate(document?.expirationDate);
  const isExpired = document?.expirationDate && new Date(String(document.expirationDate).replace(/^"|"$/g, '').trim()) < new Date();

  return (
    <div
      className={['credential-card', selectable && 'selectable', selected && 'selected'].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      <div className="credential-card-header">
        <span className="credential-type-badge">{document.humanizedType || (document.type?.slice(-1)[0]) || 'Credential'}</span>
        <div className="credential-header-actions">
          {isExpired
            ? <span className="credential-status expired">Expired</span>
            : <span className="credential-status valid">Valid</span>}
          {onDelete && (
            <button
              className="delete-credential-icon-btn"
              data-testid={`delete-credential-${document.id}`}
              aria-label="Delete credential"
              title="Delete credential"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(document.id);
              }}
              disabled={deleting}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="delete-credential-icon" title="Delete credential">
                <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showJson ? (
        <div className="credential-raw-json">
          <pre>{JSON.stringify(rawDocument || document, null, 2)}</pre>
        </div>
      ) : (
        subjectEntries.length > 0 && (
          <div className="credential-attributes">
            {visibleEntries.map(([key, value]) => (
              <AttributeNode
                key={key}
                label={key}
                value={value}
              />
            ))}
            {hasMore && (
              <button
                className="expand-btn"
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              >
                {expanded ? 'Show less' : `Show ${subjectEntries.length - PREVIEW_COUNT} more…`}
              </button>
            )}
          </div>
        )
      )}

      <div className="credential-card-footer">
        {issuerName && (
          <div className="footer-section issuer-section">
            <span className="footer-section-label">Issued By</span>
            <div className="issuer-identity">
              {issuerLogoUrl && (
                <img src={issuerLogoUrl} alt={issuerName} title={issuerName} className="issuer-logo" />
              )}
              <span className="issuer-value">{issuerName}</span>
            </div>
          </div>
        )}
        <div className="footer-meta">
          {issuanceDate && (
            <div className="credential-footer-item">
              <span className="footer-label">Issued</span>
              <span className="footer-value">{issuanceDate}</span>
            </div>
          )}
          {expirationDate && (
            <div className="credential-footer-item">
              <span className="footer-label">Expires</span>
              <span className={`footer-value ${isExpired ? 'expired-text' : ''}`}>{expirationDate}</span>
            </div>
          )}
          <div className="credential-footer-item id-row">
            <span className="footer-label">ID</span>
            <span className="footer-value credential-id-value">{document.id}</span>
          </div>
        </div>
        <div className="footer-bottom">
          <button
            className="view-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowJson((v) => !v);
            }}
          >
            {showJson ? 'View Card' : 'View JSON'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CredentialCard;
