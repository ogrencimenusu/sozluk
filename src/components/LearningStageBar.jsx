import React from 'react';
import { ProgressBar } from 'react-bootstrap';

/**
 * LearningStageBar
 * stage: 0-10 integer
 * showLabel: boolean — show "Aşama X/10" text
 * size: 'sm' | 'md' (default 'sm')
 */
function LearningStageBar({ stage = 0, showLabel = false, size = 'sm' }) {
    const clamped = Math.max(0, Math.min(10, stage ?? 0));
    const pct = clamped * 10;

    let variant;
    if (clamped <= 3) variant = 'danger';
    else if (clamped <= 6) variant = 'warning';
    else if (clamped <= 9) variant = 'info';
    else variant = 'success';

    const height = size === 'sm' ? '5px' : '8px';

    return (
        <div className="w-100">
            {showLabel && (
                <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-muted" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.3px' }}>
                        ÖĞR. AŞAMASI
                    </span>
                    <span
                        className={`fw-bold`}
                        style={{
                            fontSize: '11px',
                            color: variant === 'danger' ? '#dc3545' : variant === 'warning' ? '#ffc107' : variant === 'info' ? '#0dcaf0' : '#198754'
                        }}
                    >
                        {clamped}/10
                    </span>
                </div>
            )}
            <ProgressBar
                now={pct}
                variant={variant}
                style={{ height }}
                className="rounded-pill"
                title={`Öğrenme Aşaması: ${clamped}/10`}
            />
        </div>
    );
}

export default LearningStageBar;
