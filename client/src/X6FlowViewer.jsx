import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Graph, Shape, Selection, Export } from '@antv/x6';
import dagre from 'dagre';

const NODE_W = 220;
const NODE_H = 76;

function makeTextMeasurer() {
  let canvas;
  let ctx;
  return (text, fontSize = 12, fontFamily = 'Arial, sans-serif', fontWeight = 'normal') => {
    if (!canvas) {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
    }
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    return ctx.measureText(String(text)).width;
  };
}
const measureTextWidth = makeTextMeasurer();

function wrapTextToLines(text, maxWidth, fontSize = 12, fontWeight = 'normal') {
  const t = String(text || '').trim();
  if (!t) return [];
  const hasSpace = /\s/.test(t);
  const byChars = (str) => {
    const out = [];
    let cur = '';
    for (const ch of str) {
      const cand = cur + ch;
      if (measureTextWidth(cand, fontSize, 'Arial, sans-serif', fontWeight) <= maxWidth) {
        cur = cand;
      } else {
        if (cur) out.push(cur);
        cur = ch;
      }
    }
    if (cur) out.push(cur);
    return out;
  };
  if (!hasSpace) return byChars(t);
  const words = t.split(/\s+/);
  const lines = [];
  let cur = '';
  words.forEach(w => {
    const candidate = cur ? cur + ' ' + w : w;
    if (measureTextWidth(candidate, fontSize, 'Arial, sans-serif', fontWeight) <= maxWidth) {
      cur = candidate;
    } else {
      if (measureTextWidth(w, fontSize, 'Arial, sans-serif', fontWeight) > maxWidth) {
        if (cur) { lines.push(cur); cur = ''; }
        const broken = byChars(w);
        lines.push(...broken.slice(0, -1));
        cur = broken[broken.length - 1] || '';
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
  });
  if (cur) lines.push(cur);
  return lines;
}

// ─── Dagre layout ─────────────────────────────────────────────────────────────
function runDagreLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 80, marginx: 40, marginy: 40 });

  nodes.forEach(n => {
    if (n.isGroup) {
      g.setNode(n.id, { label: n.id, width: 240, height: 120 });
    } else {
      g.setNode(n.id, { width: NODE_W, height: NODE_H });
      if (n.parent) g.setParent(n.id, n.parent);
    }
  });

  const groupIds = new Set(nodes.filter(n => n.isGroup).map(n => n.id));
  const groupFirstChild = {};
  nodes.forEach(n => {
    if (n.parent && !groupFirstChild[n.parent]) groupFirstChild[n.parent] = n.id;
  });

  const isSafe = (s, t) => {
    if (s === t) return false;
    let p = g.parent(s);
    while (p) { if (p === t) return false; p = g.parent(p); }
    p = g.parent(t);
    while (p) { if (p === s) return false; p = g.parent(p); }
    return true;
  };

  edges.forEach(e => {
    let s = e.source, t = e.target;
    if (groupIds.has(s) && groupFirstChild[s]) s = groupFirstChild[s];
    if (groupIds.has(t) && groupFirstChild[t]) t = groupFirstChild[t];
    if (isSafe(s, t)) g.setEdge(s, t);
  });

  dagre.layout(g);

  const positions = {};
  nodes.forEach(n => {
    const d = g.node(n.id);
    if (!d) return;
    if (n.isGroup) {
      positions[n.id] = { x: d.x - d.width / 2, y: d.y - d.height / 2, w: d.width, h: d.height };
    } else {
      positions[n.id] = { x: d.x - NODE_W / 2, y: d.y - NODE_H / 2, w: NODE_W, h: NODE_H };
    }
  });
  return positions;
}

// ─── JSON → graph nodes/edges ─────────────────────────────────────────────────
function parseNodeDetails(nodeDetails) {
  const nodes = [];
  const edges = [];
  const isOverlayId = (val) => {
    const id = String(val || '');
    return id.endsWith('__hdr') || id.endsWith('__sub');
  };

  let normalized = {};
  if (Array.isArray(nodeDetails)) {
    nodeDetails.forEach((m, idx) => {
      if (!m) return;
      const key =
        (m.id && String(m.id).trim()) ||
        (m.name && String(m.name).trim()) ||
        `Module_${idx + 1}`;
      normalized[key] = { ...m, id: m.id || key, name: m.name || key };
    });
  } else {
    normalized = nodeDetails || {};
  }

  Object.entries(normalized).forEach(([modName, mod]) => {
    if (isOverlayId(modName) || isOverlayId(mod?.id) || isOverlayId(mod?.name)) return;
    const hasChildren = mod.sub_nodes?.length > 0;
    if (hasChildren) {
      nodes.push({ id: modName, label: mod.name || modName, desc: mod.brief_description || '', isGroup: true, parent: null });
      mod.sub_nodes.forEach((sn, sIdx) => {
        const snId =
          (sn.id && String(sn.id).trim()) ||
          (sn.name && String(sn.name).trim()) ||
          `${modName}_sub_${sIdx + 1}`;
        nodes.push({ id: snId, label: sn.name || snId, desc: sn.brief_description || '', isGroup: false, parent: modName });
      });
    } else {
      nodes.push({ id: modName, label: mod.name || modName, desc: mod.brief_description || '', isGroup: false, parent: null });
    }

    mod.ports?.outgoing?.forEach((e, i) => {
      let src = e.originates_from_internal_node || e.source_node || modName;
      let tgt = e.connects_to_internal_node || e.target_node || e.target_mod;
      if (!src || src === 'null' || src === 'None') src = modName;
      if (!tgt || tgt === 'null' || tgt === 'None') tgt = e.target_mod;
      if (src && tgt) edges.push({ id: `out-${modName}-${i}`, source: src, target: tgt, label: e.edge_label || '', dashed: false });
    });

    mod.ports?.internal_flow?.forEach((e, i) => {
      const src = e.source_node, tgt = e.target_node;
      if (src && tgt && src !== 'null' && src !== 'None' && tgt !== 'null' && tgt !== 'None')
        edges.push({ id: `in-${modName}-${i}`, source: src, target: tgt, label: e.edge_label || '', dashed: true });
    });
  });

  const validIds = new Set(nodes.map(n => n.id));
  return { nodes, edges: edges.filter(e => validIds.has(e.source) && validIds.has(e.target)) };
}

// ─── Graph → JSON ─────────────────────────────────────────────────────────────
function graphToNodeDetails(graph, originalNodeDetails) {
  const normalizeText = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  let normalized = {};
  if (Array.isArray(originalNodeDetails)) {
    originalNodeDetails.forEach(m => {
      if (!m) return;
      const raw = JSON.parse(JSON.stringify(m));
      const key = m.id || m.name;
      if (key) normalized[key] = raw;
      if (m.name) normalized[m.name] = raw;
    });
  } else {
    normalized = JSON.parse(JSON.stringify(originalNodeDetails || {}));
  }

  const allNodes = graph.getNodes();
  const allEdges = graph.getEdges();

  const childParentMap = {};
  const groupChildren = {};
  const titleTextMap = {};
  const descTextMap = {};
  allNodes.forEach(n => {
    const id = String(n.id || '');
    if (id.endsWith('__hdr')) {
      const baseId = id.slice(0, -5);
      const text = n.attr('label/text') || n.getProp('label') || '';
      if (text) titleTextMap[baseId] = normalizeText(text);
      return;
    }
    if (id.endsWith('__sub')) {
      const baseId = id.slice(0, -5);
      const text = n.attr('label/text') || n.getProp('label') || '';
      if (text) descTextMap[baseId] = normalizeText(text);
      return;
    }
    const parent = n.getParent();
    if (parent && parent.isNode()) {
      childParentMap[n.id] = parent.id;
      if (!groupChildren[parent.id]) groupChildren[parent.id] = [];
      groupChildren[parent.id].push(n.id);
    }
  });

  const groupIds = new Set(Object.keys(groupChildren));
  const childIds = new Set(Object.keys(childParentMap));
  const newDetails = {};

  allNodes.forEach(node => {
    const nodeId = String(node.id || '');
    if (nodeId.endsWith('__hdr') || nodeId.endsWith('__sub')) return;
    if (childIds.has(node.id)) return;
    const label = node.attr('label/text') || node.getProp('label') || nodeId;
    const displayName = titleTextMap[nodeId] || normalizeText(label) || nodeId;
    const displayDesc = descTextMap[nodeId] || '';
    const isGroup = groupIds.has(nodeId);
    // 优先使用 id 查找，如果没有再用 label
    const orig = normalized[nodeId] || normalized[label] || {};

    const entry = {
      id: nodeId,
      name: displayName,
      role: orig.role || 'processing', // 保留 role，默认为 processing
      brief_description: displayDesc || orig.brief_description || orig.desc || '',
      function: orig.function || '',
      technical_methods: orig.technical_methods || '',
      ports: { incoming: [], outgoing: [], internal_flow: [] },
      ...(orig.reference ? { reference: orig.reference } : {}),
      ...(orig.references ? { references: orig.references } : { references: 'None' }),
    };

    if (isGroup) {
      entry.sub_nodes = (groupChildren[nodeId] || []).map(childId => {
        const childNode = graph.getCellById(childId);
        const childLabel = childNode?.attr('label/text') || childNode?.getProp('label') || childId;
        // 子节点查找逻辑
        const origChild = orig.sub_nodes?.find(sn => sn.id === childId) || orig.sub_nodes?.find(sn => sn.name === childId) || {};
        return { 
          id: childId,
          name: childLabel, 
          brief_description: origChild.brief_description || '', 
          function: origChild.function || '', 
          technical_methods: origChild.technical_methods || '' 
        };
      });
    }

    newDetails[nodeId] = entry;
  });

  allEdges.forEach(edge => {
    const srcId = edge.getSourceCellId();
    const tgtId = edge.getTargetCellId();
    if (!srcId || !tgtId) return;
    const labelFromLabels = edge.getLabels?.()[0]?.attrs?.label?.text || edge.getLabels?.()[0]?.attrs?.text?.text || '';
    const label = edge.attr('label/text') || edge.getProp('label') || labelFromLabels || '';
    const isDashed = edge.getProp('dashed') === true;
    const srcParent = childParentMap[srcId];
    const tgtParent = childParentMap[tgtId];

    if (isDashed && srcParent && srcParent === tgtParent) {
      const parentEntry = newDetails[srcParent];
      if (parentEntry) parentEntry.ports.internal_flow.push({ source_node: srcId, target_node: tgtId, edge_label: label });
    } else {
      const ownerModId = srcParent || srcId;
      const ownerEntry = newDetails[ownerModId];
      if (ownerEntry) {
        const tgtModId = tgtParent || tgtId;
        ownerEntry.ports.outgoing.push({ originates_from_internal_node: srcParent ? srcId : null, connects_to_internal_node: tgtParent ? tgtId : null, source_node: srcId, target_node: tgtId, target_mod: tgtModId, edge_label: label });
      }
    }
  });

  return newDetails;
}

// ─── Render nodes+edges into an existing graph instance ──────────────────────
function renderGraph(graph, nodeDetails) {
  try {
    const t = Array.isArray(nodeDetails) ? 'array' : typeof nodeDetails;
    const n = Array.isArray(nodeDetails) ? nodeDetails.length : (nodeDetails ? Object.keys(nodeDetails).length : 0);
    console.debug('[X6] renderGraph input:', t, n);
  } catch (e) { void e; }
  try { graph.clearCells(); } catch (e) { void e; }
  try {
    const cells = graph.getCells();
    if (cells && cells.length) graph.removeCells(cells);
  } catch (e) { void e; }
  if (
    !nodeDetails ||
    (Array.isArray(nodeDetails) ? nodeDetails.length === 0 : Object.keys(nodeDetails).length === 0)
  ) {
    return;
  }

  let parsedNodes = [];
  let parsedEdges = [];
  try {
    const parsed = parseNodeDetails(nodeDetails);
    parsedNodes = parsed.nodes;
    parsedEdges = parsed.edges;
  } catch (err) {
    console.error("Parse error:", err);
    return;
  }

  if (parsedNodes.length === 0) return;

  let positions = {};
  try {
    positions = runDagreLayout(parsedNodes, parsedEdges);
  } catch (e) {
    console.error('Layout error:', e);
    parsedNodes.forEach((n, i) => { positions[n.id] = { x: (i % 5) * 260, y: Math.floor(i / 5) * 100, w: NODE_W, h: NODE_H }; });
  }

  const portsDef = (id) => ({
    groups: {
      top:    { position: 'top',    attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
      bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
      left:   { position: 'left',   attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
      right:  { position: 'right',  attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
    },
    items: [
      { id: `${id}-top`, group: 'top' },
      { id: `${id}-bottom`, group: 'bottom' },
      { id: `${id}-left`, group: 'left' },
      { id: `${id}-right`, group: 'right' },
    ],
  });

  const clampInside = (child, parent) => {
    if (!child || !parent) return;
    const pb = parent.getBBox();
    const data = parent.getData ? parent.getData() : {};
    const overlayTop = (data && data.overlayTop) || 0;
    const pad = 12;
    const b = child.getBBox();
    let nx = b.x;
    let ny = b.y;
    const minX = pb.x + pad;
    const maxX = pb.x + pb.width - b.width - pad;
    const minY = pb.y + overlayTop + pad;
    const maxY = pb.y + pb.height - b.height - pad;
    if (nx < minX) nx = minX;
    if (nx > maxX) nx = Math.max(minX, maxX);
    if (ny < minY) ny = minY;
    if (ny > maxY) ny = Math.max(minY, maxY);
    if (nx !== b.x || ny !== b.y) child.position(nx, ny);
  };

  // Groups first
  const overlayTopMap = {};
  parsedNodes.filter(n => n.isGroup).forEach(n => {
    const pos = positions[n.id] || { x: 0, y: 0, w: 240, h: 120 };
    const innerW = Math.max(10, pos.w - 24);
    const titleLines = wrapTextToLines(n.label, innerW, 12, 'bold');
    const rawDesc = (n.desc || '').replace(/\s+/g, ' ').trim();
    const descLines = wrapTextToLines(rawDesc, innerW, 10, 'normal');
    const titleH = Math.max(18, titleLines.length * 14);
    const descH = descLines.length > 0 ? descLines.length * 12 : 0;
    const overlayTop = 10 + titleH + (descH ? 6 + descH : 0);
    overlayTopMap[n.id] = overlayTop;
    const group = graph.addNode({
      id: n.id, shape: 'rect', x: pos.x, y: pos.y, width: pos.w, height: pos.h, zIndex: 0,
      attrs: {
        body: { fill: 'rgba(33,124,243,0.05)', stroke: '#217cf3', strokeWidth: 2, strokeDasharray: '6 3', rx: 8, ry: 8 },
        label: { text: '', fontSize: 12, fontWeight: 'bold', fill: '#217cf3', refX: 0.5, refY: 0.5, textAnchor: 'middle', textVerticalAnchor: 'middle' },
      },
      ports: portsDef(n.id),
    });
    try { group.setData && group.setData({ overlayTop: overlayTop }); } catch (e) { void e; }
    const titleNode = graph.addNode({
      id: `${n.id}__hdr`,
      shape: 'rect',
      x: pos.x + 12,
      y: pos.y + 10,
      width: innerW,
      height: titleH,
      zIndex: 5,
      attrs: {
        body: { fill: 'transparent', stroke: 'transparent', pointerEvents: 'none' },
        label: { text: titleLines.join('\n'), fontSize: 12, fontWeight: 'bold', fill: '#217cf3', textAnchor: 'middle', textVerticalAnchor: 'top', refX: 0.5, refY: 0, pointerEvents: 'none' },
      },
      ports: { groups: {}, items: [] },
    });
    const descNode = graph.addNode({
      id: `${n.id}__sub`,
      shape: 'rect',
      x: pos.x + 12,
      y: pos.y + 10 + titleH + 6,
      width: innerW,
      height: descH || 12,
      zIndex: 5,
      attrs: {
        body: { fill: 'transparent', stroke: 'transparent', pointerEvents: 'none' },
        label: { text: descLines.join('\n'), fontSize: 10, fill: '#666', textAnchor: 'middle', textVerticalAnchor: 'top', refX: 0.5, refY: 0, pointerEvents: 'none' },
      },
      ports: { groups: {}, items: [] },
    });
    group.addChild(titleNode);
    group.addChild(descNode);
    const newH = pos.h + overlayTop;
    group.resize(pos.w, newH);
  });

  // Leaf nodes
  parsedNodes.filter(n => !n.isGroup).forEach(n => {
    const pos = positions[n.id] || { x: 0, y: 0, w: NODE_W, h: NODE_H };
    const oy = n.parent ? (overlayTopMap[n.parent] || 0) : 0;
    const isTopLevelLeaf = !n.parent;
    if (isTopLevelLeaf) {
      const innerW = Math.max(10, pos.w - 24);
      const rawDesc = (n.desc || '').replace(/\s+/g, ' ').trim();
      const titleLines = wrapTextToLines(n.label, innerW, 13, 'bold');
      const descLines = wrapTextToLines(rawDesc, innerW, 11, 'normal');
      const gap = 12;
      const titleH = Math.max(18, titleLines.length * 16);
      const descH = descLines.length > 0 ? Math.max(12, descLines.length * 14) : 0;
      const dynH = Math.max(pos.h, 20 + titleH + (descH ? gap + descH : 0) + 10);
      const group = graph.addNode({
        id: n.id,
        shape: 'rect',
        x: pos.x,
        y: pos.y + oy,
        width: pos.w,
        height: dynH,
        zIndex: 1,
        attrs: {
          body: { fill: 'rgba(33,124,243,0.05)', stroke: '#217cf3', strokeWidth: 2, strokeDasharray: '6 3', rx: 8, ry: 8 },
          label: { text: '', fontSize: 12, fill: '#217cf3', textAnchor: 'middle', textVerticalAnchor: 'middle', refX: 0.5, refY: 0.5 },
        },
        ports: portsDef(n.id),
      });
      const overlayTop = 12 + titleH + (descH ? gap + descH : 0);
      try { group.setData && group.setData({ overlayTop }); } catch (e) { void e; }
      const titleNode = graph.addNode({
        id: `${n.id}__hdr`,
        shape: 'rect',
        x: pos.x + 12,
        y: pos.y + oy + 12,
        width: innerW,
        height: titleH,
        zIndex: 5,
        attrs: {
          body: { fill: 'transparent', stroke: 'transparent', pointerEvents: 'none' },
          label: { text: titleLines.join('\n'), fontSize: 13, fontWeight: 'bold', fill: '#217cf3', textAnchor: 'middle', textVerticalAnchor: 'top', refX: 0.5, refY: 0, pointerEvents: 'none' },
        },
        ports: { groups: {}, items: [] },
      });
      const descNode = graph.addNode({
        id: `${n.id}__sub`,
        shape: 'rect',
        x: pos.x + 12,
        y: pos.y + oy + 12 + titleH + gap,
        width: innerW,
        height: descH || 12,
        zIndex: 5,
        attrs: {
          body: { fill: 'transparent', stroke: 'transparent', pointerEvents: 'none' },
          label: { text: descLines.join('\n'), fontSize: 11, fill: '#666', textAnchor: 'middle', textVerticalAnchor: 'top', refX: 0.5, refY: 0, pointerEvents: 'none' },
        },
        ports: { groups: {}, items: [] },
      });
      group.addChild(titleNode);
      group.addChild(descNode);
    } else {
      const innerW = Math.max(10, pos.w - 24);
      const rawDesc = (n.desc || '').replace(/\s+/g, ' ').trim();
      const titleLines = wrapTextToLines(n.label, innerW, 12, 'bold');
      const descLines = wrapTextToLines(rawDesc, innerW, 10, 'normal');
      const lines = descLines.length > 0 ? [...titleLines, ...descLines] : [...titleLines];
      const labelText = lines.join('\n');
      const dynH = Math.max(pos.h, 18 + lines.length * 12);
      const added = graph.addNode({
        id: n.id,
        shape: 'rect',
        x: pos.x,
        y: pos.y + oy,
        width: pos.w,
        height: dynH,
        zIndex: 1,
        attrs: {
          body: { fill: '#ffffff', stroke: '#666', strokeWidth: 1.5, rx: 4, ry: 4 },
          label: { text: labelText, fontSize: 11, fill: '#333', textAnchor: 'middle', textVerticalAnchor: 'middle', refX: 0.5, refY: 0.5 },
        },
        ports: portsDef(n.id),
      });
      if (n.parent) {
        const parentCell = graph.getCellById(n.parent);
        if (parentCell) {
          parentCell.addChild(added);
          clampInside(added, parentCell);
        }
      }
      return;
    }
    if (n.parent) {
      const parentCell = graph.getCellById(n.parent);
      if (parentCell) {
        const base = graph.getCellById(n.id);
        if (base) parentCell.addChild(base);
      }
    }
  });

  // Edges
  parsedEdges.forEach(e => {
    const labels = e.label
      ? [{ attrs: { label: { text: e.label, fontSize: 10, fill: '#666' } }, position: { distance: 0.5 } }]
      : [];
    graph.addEdge({
      id: e.id, source: e.source, target: e.target, dashed: e.dashed, zIndex: 2,
      label: e.label || '',
      router: { name: 'orth' },
      connector: { name: 'rounded', args: { radius: 8 } },
      attrs: {
        line: {
          stroke: e.dashed ? '#aaa' : '#999',
          strokeWidth: 1.5,
          strokeDasharray: e.dashed ? '5 3' : '0',
          targetMarker: { name: 'block', size: 8, fill: e.dashed ? '#aaa' : '#999' },
        },
      },
      labels,
    });
  });

  setTimeout(() => { 
    try { 
      graph.zoomToFit({ padding: 20, maxScale: 1.8 }); 
    } catch (e) { void e; } 
  }, 50);
}

// ─── Component ────────────────────────────────────────────────────────────────
const X6FlowViewer = forwardRef(function X6FlowViewer(
  { nodeDetails, onNodeClick, onPaneClick, onNodeDetailsChange },
  ref
) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const graphReadyRef = useRef(false);
  const isInternalUpdateRef = useRef(false);  // Flag to prevent render loops
  const isRenderingRef = useRef(false);
  const nodeDetailsRef = useRef(nodeDetails);
  const pendingRenderRef = useRef(null);  // Queues data that arrived before graph was ready
  nodeDetailsRef.current = nodeDetails;

  const createGraphInstance = useCallback((w, h) => {
    const container = containerRef.current;
    if (!container) return null;
    const graph = new Graph({
      container,
      width: w,
      height: h,
      autoResize: true,
      background: { color: '#f8f9fa' },
      grid: { visible: true, type: 'dot', args: { color: '#ccc', thickness: 1 } },
      panning: { enabled: true, eventTypes: ['leftMouseDown', 'mouseWheel'] },
      mousewheel: { enabled: true, modifiers: null },
      connecting: {
        router: 'orth',
        connector: { name: 'rounded', args: { radius: 8 } },
        anchor: 'center',
        connectionPoint: 'boundary',
        allowBlank: false,
        allowLoop: false,
        highlight: true,
        createEdge() {
          return new Shape.Edge({
            attrs: { line: { stroke: '#999', strokeWidth: 1.5, targetMarker: { name: 'block', size: 8 } } },
            zIndex: 0,
          });
        },
      },
      highlighting: {
        magnetAdsorbed: { name: 'stroke', args: { attrs: { fill: '#fff', stroke: '#217cf3', strokeWidth: 3 } } },
      },
      interacting: { nodeMovable: true, edgeMovable: true, edgeLabelMovable: false, magnetConnectable: true },
    });
    graph.use(new Selection({ enabled: true, multiple: true, rubberband: true, movable: true, showNodeSelectionBox: true, modifiers: ['shift'] }));
    graph.use(new Export());
    const syncOverlayLayout = (parentNode) => {
      if (!parentNode || !(parentNode.isNode && parentNode.isNode())) return;
      const id = String(parentNode.id || '');
      if (!id || id.endsWith('__hdr') || id.endsWith('__sub')) return;
      const data = parentNode.getData ? parentNode.getData() : {};
      if (!data || typeof data.overlayTop !== 'number') return;
      const hdr = graph.getCellById(`${id}__hdr`);
      const sub = graph.getCellById(`${id}__sub`);
      if (!hdr || !sub) return;
      const pb = parentNode.getBBox();
      const innerW = Math.max(10, pb.width - 24);
      const titleRaw = String(hdr.attr('label/text') || hdr.getProp('label') || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      const descRaw = String(sub.attr('label/text') || sub.getProp('label') || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      const titleLines = wrapTextToLines(titleRaw, innerW, 12, 'bold');
      const descLines = wrapTextToLines(descRaw, innerW, 10, 'normal');
      const titleH = Math.max(18, titleLines.length * 14);
      const descH = descLines.length > 0 ? descLines.length * 12 : 0;
      const overlayTop = 10 + titleH + (descH ? 6 + descH : 0);
      hdr.position(pb.x + 12, pb.y + 10);
      hdr.resize(innerW, titleH);
      hdr.attr('label/text', titleLines.join('\n'));
      sub.position(pb.x + 12, pb.y + 10 + titleH + 6);
      sub.resize(innerW, descH || 12);
      sub.attr('label/text', descLines.join('\n'));
      try { parentNode.setData && parentNode.setData({ ...data, overlayTop }); } catch (e) { void e; }
      const minH = overlayTop + 80;
      if (pb.height < minH) parentNode.resize(pb.width, minH);
    };
    graph.on('node:change:position', ({ node }) => {
      const id = String(node?.id || '');
      if (id.endsWith('__hdr') || id.endsWith('__sub')) return;
      const parent = node.getParent && node.getParent();
      if (parent && parent.isNode && parent.isNode()) {
        const pb = parent.getBBox();
        const data = parent.getData ? parent.getData() : {};
        const overlayTop = (data && data.overlayTop) || 0;
        const pad = 12;
        const b = node.getBBox();
        let nx = b.x;
        let ny = b.y;
        const minX = pb.x + pad;
        const maxX = pb.x + pb.width - b.width - pad;
        const minY = pb.y + overlayTop + pad;
        const maxY = pb.y + pb.height - b.height - pad;
        if (nx < minX) nx = minX;
        if (nx > maxX) nx = Math.max(minX, maxX);
        if (ny < minY) ny = minY;
        if (ny > maxY) ny = Math.max(minY, maxY);
        if (nx !== b.x || ny !== b.y) node.position(nx, ny);
      }
    });
    graph.on('node:click', ({ node }) => { if (onNodeClick) onNodeClick(node.id); });
    graph.on('blank:click', () => { if (onPaneClick) onPaneClick(); });
    graph.on('node:dblclick', ({ node, e }) => {
      e.stopPropagation();
      if (isRenderingRef.current) return;
      const cur = node.attr('label/text') || node.getProp('label') || node.id;
      const next = window.prompt('重命名节点:', cur);
      if (next !== null && next.trim() && next.trim() !== cur) {
        node.attr('label/text', next.trim());
        const g = graphRef.current;
        if (g && onNodeDetailsChange) {
          isInternalUpdateRef.current = true;
          onNodeDetailsChange(graphToNodeDetails(g, nodeDetailsRef.current));
        }
      }
    });
    graph.on('edge:dblclick', ({ edge, e }) => {
      e.stopPropagation();
      if (isRenderingRef.current) return;
      const cur =
        edge.getLabels?.()[0]?.attrs?.label?.text ||
        edge.getLabels?.()[0]?.attrs?.text?.text ||
        edge.attr('label/text') ||
        edge.getProp('label') ||
        '';
      const next = window.prompt('编辑连线标签:', cur);
      if (next !== null) {
        const text = next.trim();
        if (text) {
          edge.setLabels([{ attrs: { label: { text, fontSize: 10, fill: '#666' } }, position: { distance: 0.5 } }]);
        } else {
          edge.setLabels([]);
        }
      }
      const g = graphRef.current;
      if (g && onNodeDetailsChange) {
        isInternalUpdateRef.current = true;
        onNodeDetailsChange(graphToNodeDetails(g, nodeDetailsRef.current));
      }
    });
    graph.on('node:removed', ({ node }) => {
      if (isRenderingRef.current) return;
      const g = graphRef.current;
      if (!g) return;
      try {
        const id = String(node?.id || '');
        if (!id.endsWith('__hdr') && !id.endsWith('__sub')) {
          const hdr = g.getCellById(`${id}__hdr`);
          const sub = g.getCellById(`${id}__sub`);
          const toRemove = [];
          if (hdr) toRemove.push(hdr);
          if (sub) toRemove.push(sub);
          if (toRemove.length) g.removeCells(toRemove);
        }
      } catch (e) { void e; }
      try {
        const all = g.getNodes?.() || [];
        all.forEach(p => {
          const data = p.getData ? p.getData() : {};
          if (data && typeof data.overlayTop === 'number') {
            const pb = p.getBBox();
            const pad = 12;
            const overlayTop = data.overlayTop || 0;
            const children = (p.getChildren?.() || []).filter(c => {
              const cid = String(c.id || '');
              return c.isNode && c.isNode() && !cid.endsWith('__hdr') && !cid.endsWith('__sub');
            });
            let needW = 240, needH = overlayTop + 80;
            if (children.length > 0) {
              let maxX = 0, maxY = 0;
              children.forEach(c => {
                const cb = c.getBBox();
                maxX = Math.max(maxX, (cb.x - pb.x) + cb.width);
                maxY = Math.max(maxY, (cb.y - pb.y) + cb.height);
              });
              needW = Math.max(240, maxX + pad);
              needH = Math.max(overlayTop + 80, maxY + pad);
            }
            if (Math.abs(needW - pb.width) > 1 || Math.abs(needH - pb.height) > 1) {
              p.resize(needW, needH);
            }
            syncOverlayLayout(p);
          }
        });
      } catch (e) { void e; }
      if (onNodeDetailsChange) { 
        isInternalUpdateRef.current = true; 
        onNodeDetailsChange(graphToNodeDetails(g, nodeDetailsRef.current)); 
      }
    });
    graph.on('edge:added', ({ edge }) => {
      if (isRenderingRef.current) return;
      const has = edge.getLabels?.() && edge.getLabels().length > 0;
      if (!has) {
        const t = window.prompt('设置连线标签(可选):', '');
        if (t && t.trim()) {
          edge.setLabels([{ attrs: { label: { text: t.trim(), fontSize: 10, fill: '#666' } }, position: { distance: 0.5 } }]);
        }
      }
      const g = graphRef.current;
      if (g && onNodeDetailsChange) {
        isInternalUpdateRef.current = true;
        onNodeDetailsChange(graphToNodeDetails(g, nodeDetailsRef.current));
      }
    });
    graph.on('edge:removed', () => {
      if (isRenderingRef.current) return;
      const g = graphRef.current;
      if (g && onNodeDetailsChange) {
        isInternalUpdateRef.current = true;
        onNodeDetailsChange(graphToNodeDetails(g, nodeDetailsRef.current));
      }
    });
    graph.on('node:moved', () => {
      if (isRenderingRef.current) return;
      const g = graphRef.current;
      if (g && onNodeDetailsChange) {
        isInternalUpdateRef.current = true;
        onNodeDetailsChange(graphToNodeDetails(g, nodeDetailsRef.current));
      }
    });
    graph.bindKey(['backspace', 'delete'], () => {
      if (isRenderingRef.current) return;
      const cells = graph.getSelectedCells();
      if (cells.length) { graph.removeCells(cells); const g = graphRef.current; if (g && onNodeDetailsChange) { isInternalUpdateRef.current = true; onNodeDetailsChange(graphToNodeDetails(g, nodeDetailsRef.current)); } }
    });
    return graph;
  }, [onNodeClick, onPaneClick, onNodeDetailsChange]);

  useImperativeHandle(ref, () => ({
    exportImage: () =>
      new Promise((resolve, reject) => {
        const graph = graphRef.current;
        if (!graph) return reject(new Error('Graph not ready'));
        try {
          const ratio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
          graph.toPNG((dataUri) => resolve(dataUri), { padding: 20, backgroundColor: '#ffffff', ratio });
        } catch (e) { reject(e); }
      }),
  }));

  const syncToJson = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || !onNodeDetailsChange) return;
    if (isRenderingRef.current) return;
    isInternalUpdateRef.current = true;
    onNodeDetailsChange(graphToNodeDetails(graph, nodeDetailsRef.current));
  }, [onNodeDetailsChange]);

  // ── Init graph once (deferred until container has real dimensions) ────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    const create = (w, h) => {
      if (graphRef.current || disposed) return;
      const g = createGraphInstance(w, h);
      if (!g) return;
      graphRef.current = g;
      graphReadyRef.current = true;

      // Render the most recent data: use pendingRenderRef if set (from useEffect that fired
      // before graph was ready), otherwise fall back to nodeDetailsRef.current.
      const detailsToRender = pendingRenderRef.current ?? nodeDetailsRef.current;
      pendingRenderRef.current = null;
      const hasDetails = Array.isArray(detailsToRender)
        ? detailsToRender.length > 0
        : !!(detailsToRender && Object.keys(detailsToRender).length > 0);
      if (hasDetails) {
        isRenderingRef.current = true;
        try {
          renderGraph(g, detailsToRender);
        } finally {
          isRenderingRef.current = false;
        }
      }
    };

    const w0 = container.offsetWidth;
    const h0 = container.offsetHeight;
    if (w0 > 0 && h0 > 0) {
      create(w0, h0);
    } else {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            ro.disconnect();
            create(width, height);
            break;
          }
        }
      });
      ro.observe(container);
      return () => { disposed = true; ro.disconnect(); if (graphRef.current) { graphRef.current.dispose(); graphRef.current = null; } };
    }

    return () => {
      disposed = true;
      if (graphRef.current) { graphRef.current.dispose(); graphRef.current = null; }
    };
  }, [createGraphInstance]);

  // ── Re-render when nodeDetails prop changes ───────────────────────────────
  useEffect(() => {
    // Skip if this update was triggered by our own syncToJson to avoid loops
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    if (!graphReadyRef.current || !graphRef.current) {
      pendingRenderRef.current = nodeDetails;
      return;
    }
    isRenderingRef.current = true;
    try {
      const container = containerRef.current;
      const w = container?.offsetWidth || 800;
      const h = container?.offsetHeight || 600;
      if (graphRef.current) {
        // 彻底清空容器与旧实例，防止堆叠
        try { graphRef.current.dispose(); } catch (e) { void e; }
        try { if (container) container.innerHTML = ''; } catch (e) { void e; }
        graphRef.current = null;
      }
      const g = createGraphInstance(w, h);
      if (!g) return;
      graphRef.current = g;
      graphReadyRef.current = true;
      renderGraph(g, nodeDetails);
    } finally {
      isRenderingRef.current = false;
    }
  }, [nodeDetails, createGraphInstance]);

  // ── Keyboard: delete/backspace remove selected ────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onKeyDown = (e) => {
      if (!graphRef.current) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const cells = graphRef.current.getSelectedCells?.() || [];
        if (cells.length) {
          e.preventDefault();
          graphRef.current.removeCells(cells);
          syncToJson();
        }
      }
    };
    const onMouseDown = () => { container.focus?.(); };
    container.addEventListener('keydown', onKeyDown);
    container.addEventListener('mousedown', onMouseDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      container.removeEventListener('mousedown', onMouseDown);
    };
  }, [syncToJson]);

  // ── Toolbar: add node helper ──────────────────────────────────────────────
  const handleAddNode = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const name = window.prompt('模块名称:');
    if (!name?.trim()) return;
    const brief = window.prompt('模块简介(可选):') || '';
    const id = `mod-${Date.now()}`;
    const x = 120 + Math.random() * 180;
    const y = 120 + Math.random() * 120;
    const width = 240;
    const baseBodyH = 80;
    const innerW = Math.max(10, width - 24);
    const titleLines = wrapTextToLines(name.trim(), innerW, 13, 'bold');
    const descLines  = wrapTextToLines((brief || '').trim(), innerW, 11, 'normal');
    const gap = 12;
    const titleH = Math.max(18, titleLines.length * 16);
    const descH  = descLines.length > 0 ? Math.max(12, descLines.length * 14) : 0;
    const overlayTop = 12 + titleH + (descH ? gap + descH : 0);
    const height = baseBodyH + overlayTop;
    const group = graph.addNode({
      id,
      shape: 'rect',
      x, y,
      width, height,
      zIndex: 1,
      attrs: {
        body: { fill: 'rgba(33,124,243,0.05)', stroke: '#217cf3', strokeWidth: 2, strokeDasharray: '6 3', rx: 8, ry: 8 },
        label: { text: '', fontSize: 12, fill: '#217cf3', textAnchor: 'middle', textVerticalAnchor: 'middle', refX: 0.5, refY: 0.5 },
      },
      ports: {
        groups: {
          top:    { position: 'top',    attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
          bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
          left:   { position: 'left',   attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
          right:  { position: 'right',  attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
        },
        items: [
          { id: `${id}-top`, group: 'top' }, { id: `${id}-bottom`, group: 'bottom' },
          { id: `${id}-left`, group: 'left' }, { id: `${id}-right`, group: 'right' },
        ],
      },
    });
    try { group.setData && group.setData({ overlayTop }); } catch (e) { void e; }
    const titleNode = graph.addNode({
      id: `${id}__hdr`,
      shape: 'rect',
      x: x + 12,
      y: y + 12,
      width: innerW,
      height: titleH,
      zIndex: 5,
      attrs: {
        body: { fill: 'transparent', stroke: 'transparent', pointerEvents: 'none' },
        label: { text: titleLines.join('\n'), fontSize: 13, fontWeight: 'bold', fill: '#217cf3', textAnchor: 'middle', textVerticalAnchor: 'top', refX: 0.5, refY: 0, pointerEvents: 'none' },
      },
      ports: { groups: {}, items: [] },
    });
    const descNode = graph.addNode({
      id: `${id}__sub`,
      shape: 'rect',
      x: x + 12,
      y: y + 12 + titleH + gap,
      width: innerW,
      height: descH || 12,
      zIndex: 5,
      attrs: {
        body: { fill: 'transparent', stroke: 'transparent', pointerEvents: 'none' },
        label: { text: descLines.join('\n'), fontSize: 11, fill: '#666', textAnchor: 'middle', textVerticalAnchor: 'top', refX: 0.5, refY: 0, pointerEvents: 'none' },
      },
      ports: { groups: {}, items: [] },
    });
    group.addChild(titleNode);
    group.addChild(descNode);
    syncToJson();
  }, [syncToJson]);

  const handleAddSubNode = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const pad = 12;
    const getOverlayTop = (parent) => {
      const data = parent.getData ? parent.getData() : {};
      return (data && data.overlayTop) || 0;
    };
    const expandParentToFit = (parent, child) => {
      try {
        const pb = parent.getBBox();
        const overlayTop = getOverlayTop(parent);
        const cb = child.getBBox();
        const requiredW = (cb.x - pb.x) + cb.width + pad;
        const requiredH = (cb.y - pb.y) + cb.height + pad;
        const minW = Math.max(pb.width, requiredW);
        const minH = Math.max(pb.height, Math.max(requiredH, overlayTop + 80));
        if (minW > pb.width || minH > pb.height) {
          parent.resize(minW, minH);
        }
      } catch (e) { void e; }
    };
    const placeChildInGrid = (parent, childIndex) => {
      const pb = parent.getBBox();
      const overlayTop = getOverlayTop(parent);
      const contentW = Math.max(1, pb.width - 2 * pad);
      const cellW = NODE_W + pad;
      const cols = Math.max(1, Math.floor(contentW / cellW));
      const row = Math.floor(childIndex / cols);
      const col = childIndex % cols;
      const x = pb.x + pad + col * (NODE_W + pad);
      const y = pb.y + overlayTop + pad + row * (NODE_H + pad);
      return { x, y };
    };
    const recomputeGroupSize = (parent) => {
      try {
        const overlayTop = getOverlayTop(parent);
        const pb = parent.getBBox();
        const children = (parent.getChildren?.() || []).filter(c => {
          const cid = String(c.id || '');
          return c.isNode && c.isNode() && !cid.endsWith('__hdr') && !cid.endsWith('__sub');
        });
        if (children.length === 0) {
          const minW = 240;
          const minH = overlayTop + 80;
          if (pb.width !== minW || pb.height !== minH) parent.resize(minW, minH);
          return;
        }
        let maxX = 0, maxY = 0;
        children.forEach(c => {
          const cb = c.getBBox();
          maxX = Math.max(maxX, (cb.x - pb.x) + cb.width);
          maxY = Math.max(maxY, (cb.y - pb.y) + cb.height);
        });
        const needW = maxX + pad;
        const needH = Math.max(overlayTop + 80, maxY + pad);
        const newW = Math.max(needW, 240);
        const newH = Math.max(needH, overlayTop + 80);
        if (Math.abs(newW - pb.width) > 1 || Math.abs(newH - pb.height) > 1) {
          parent.resize(newW, newH);
        }
      } catch (e) { void e; }
    };
    const sel = (graph.getSelectedCells?.() || []).filter(c => c.isNode && c.isNode());
    let parentId = null;
    if (sel.length === 1) {
      const id = String(sel[0].id);
      const hdr = graph.getCellById(`${id}__hdr`);
      if (hdr) parentId = id;
    }
    if (!parentId) {
      const input = window.prompt('输入要加入的模块ID:');
      if (!input || !input.trim()) return;
      const exists = graph.getCellById(input.trim());
      const hdr = graph.getCellById(`${input.trim()}__hdr`);
      if (!exists || !hdr) return;
      parentId = input.trim();
    }
    const parent = graph.getCellById(parentId);
    if (!parent) return;
    const name = window.prompt('子节点名称:');
    if (!name || !name.trim()) return;
    const id = `sub-${Date.now()}`;
    const existingChildren = (parent.getChildren?.() || []).filter(c => {
      const cid = String(c.id || '');
      return c.isNode && c.isNode() && !cid.endsWith('__hdr') && !cid.endsWith('__sub');
    });
    const idx = existingChildren.length;
    const { x, y } = placeChildInGrid(parent, idx);
    const node = graph.addNode({
      id,
      shape: 'rect',
      x, y,
      width: NODE_W, height: NODE_H,
      attrs: {
        body: { fill: '#ffffff', stroke: '#666', strokeWidth: 1.5, rx: 4, ry: 4 },
        label: { text: name.trim(), fontSize: 12, fill: '#333', textAnchor: 'middle', textVerticalAnchor: 'middle', refX: 0.5, refY: 0.5 },
      },
      ports: {
        groups: {
          top:    { position: 'top',    attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
          bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
          left:   { position: 'left',   attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
          right:  { position: 'right',  attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
        },
        items: [
          { id: `${id}-top`, group: 'top' }, { id: `${id}-bottom`, group: 'bottom' },
          { id: `${id}-left`, group: 'left' }, { id: `${id}-right`, group: 'right' },
        ],
      },
    });
    parent.addChild(node);
    expandParentToFit(parent, node);
    recomputeGroupSize(parent);
    syncToJson();
  }, [syncToJson]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} tabIndex={0} />
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6, zIndex: 10 }}>
        <button title="放大"      onClick={() => graphRef.current?.zoom(0.1)}  style={btnStyle}>+</button>
        <button title="缩小"      onClick={() => graphRef.current?.zoom(-0.1)} style={btnStyle}>−</button>
        <button title="适应画布"  onClick={() => graphRef.current?.zoomToFit({ padding: 40, maxScale: 1.2 })} style={btnStyle}>⊡</button>
        <button title="添加节点"  onClick={handleAddNode} style={{ ...btnStyle, backgroundColor: '#217cf3', color: '#fff', borderColor: '#217cf3' }}>+ 模块</button>
        <button title="添加子节点" onClick={handleAddSubNode} style={{ ...btnStyle, backgroundColor: '#217cf3', color: '#fff', borderColor: '#217cf3' }}>+ 子节点</button>
      </div>
      <div style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 11, color: '#aaa', zIndex: 10, pointerEvents: 'none' }}>
        双击节点重命名 · 双击连线编辑标签 · 拖拽端口连线 · Delete 删除选中
      </div>
    </div>
  );
});

const btnStyle = {
  padding: '4px 10px', fontSize: 13, background: '#fff',
  border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', lineHeight: 1.4,
};

export default X6FlowViewer;
