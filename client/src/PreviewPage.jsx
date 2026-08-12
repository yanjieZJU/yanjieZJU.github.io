/**
 * PreviewPage — headless rendering target for Playwright screenshots.
 *
 * Usage:  /#/preview?plan=<url-encoded-json>
 *
 * Lifecycle:
 *   1. Parse plan JSON from query string
 *   2. Render X6FlowViewer with the plan's node_details
 *   3. Once X6 has rendered and zoomed-to-fit, set document.body dataset.ready = "1"
 *      so Playwright knows it is safe to screenshot
 *
 * The page is intentionally minimal — no toolbar, no sidebar.
 */

import { useEffect, useRef, useState, forwardRef } from 'react';
import X6FlowViewer from './X6FlowViewer';

export default function PreviewPage() {
  const [nodeDetails, setNodeDetails] = useState([]);
  const [ready, setReady] = useState(false);
  const viewerRef = useRef(null);

  useEffect(() => {
    try {
      // URL is /#/preview?plan=... — query string is inside the hash, not location.search
      const hash = window.location.hash;           // "#/preview?plan=..."
      const qIdx = hash.indexOf('?');
      const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx) : '');
      const raw = params.get('plan');
      if (!raw) return;
      const plan = JSON.parse(decodeURIComponent(raw));
      const details = Array.isArray(plan) ? plan : (plan.node_details ?? plan.module_details ?? []);
      setNodeDetails(details);
    } catch (e) {
      console.error('[PreviewPage] failed to parse plan:', e);
    }
  }, []);

  // When ready, call X6's own toPNG (captures full graph bounds, not viewport)
  // and expose the result so Playwright can read it via page.evaluate()
  useEffect(() => {
    if (nodeDetails.length === 0) return;
    const t = setTimeout(() => {
      const viewer = viewerRef.current;
      if (viewer && viewer.exportImage) {
        viewer.exportImage()
          .then((dataUri) => {
            window.__PNG_RESULT__ = dataUri;
            document.body.dataset.ready = '1';
            setReady(true);
          })
          .catch(() => {
            document.body.dataset.ready = '1';
            setReady(true);
          });
      } else {
        document.body.dataset.ready = '1';
        setReady(true);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [nodeDetails]);

  return (
    <div
      style={{
        width: '2400px',
        height: '1200px',
        position: 'relative',
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <X6FlowViewer
        ref={viewerRef}
        nodeDetails={nodeDetails}
        onNodeClick={() => {}}
        onPaneClick={() => {}}
        onNodeDetailsChange={() => {}}
      />
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: '#888',
        }}>
          Rendering…
        </div>
      )}
    </div>
  );
}
