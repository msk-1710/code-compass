import React from 'react';

const EdgeLegend: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: 'rgba(13, 17, 23, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '10px 14px',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        fontSize: '12px',
        color: '#e2e8f0',
        minWidth: '190px',
      }}
    >
      <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Edge Hover Guide
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '24px',
              height: '3px',
              backgroundColor: '#2ecc71',
              borderRadius: '2px',
            }}
          />
          <span>Dependencies (outgoing)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '24px',
              height: '3px',
              backgroundColor: '#3498db',
              borderRadius: '2px',
            }}
          />
          <span>Dependents (incoming)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '24px',
              height: '3px',
              backgroundColor: '#e74c3c',
              borderRadius: '2px',
            }}
          />
          <span>Circular dependencies</span>
        </div>
      </div>
    </div>
  );
};

export default EdgeLegend;