import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Graph, Shape, Selection, Export } from '@antv/x6';

const NODE_W = 220;
const NODE_H = 76;
const GROUP_W = 280;

const ROLE_THEME = {
  input: { fill: 'rgba(56,132,255,0.1)', stroke: '#3b82f6', text: '#2456b3', light: '#e8f1ff' },
  processing: { fill: 'rgba(245,158,11,0.11)', stroke: '#f59e0b', text: '#9a6700', light: '#fff4df' },
  output: { fill: 'rgba(34,197,94,0.12)', stroke: '#22c55e', text: '#1f7a3c', light: '#e7f9ee' },
  data: { fill: 'rgba(156,163,175,0.1)', stroke: '#9ca3af', text: '#4b5563', light: '#f3f4f6' },
  unknown: { fill: 'rgba(245,158,11,0.11)', stroke: '#f59e0b', text: '#9a6700', light: '#fff4df' },
};

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function getRoleLane(role) {
  const raw = normalizeRole(role);
  if (!raw) return 'unknown';
  const category = raw.includes(':') ? raw.split(':')[0].trim() : raw;
  if (category.includes('data') || category.includes('storage') || category.includes('database') || category.includes('knowledge')) return 'data';
  if (category.includes('input') || category.includes('sensing')) return 'input';
  if (category.includes('output') || category.includes('actuation') || category.includes('presentation')) return 'output';
  if (category.includes('processing') || category.includes('core') || category.includes('inference') || category.includes('reasoning')) return 'processing';
  if (raw.includes('data') || raw.includes('storage') || raw.includes('database')) return 'data';
  if (raw.includes('input')) return 'input';
  if (raw.includes('output')) return 'output';
  if (raw.includes('processing')) return 'processing';
  return 'unknown';
}

function parseImportance(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  const t = String(value || '').trim().toLowerCase();
  if (!t) return 0.5;
  if (t === 'high' || t === 'critical' || t === 'p0') return 1;
  if (t === 'medium' || t === 'normal' || t === 'p1') return 0.66;
  if (t === 'low' || t === 'minor' || t === 'p2') return 0.33;
  const n = Number.parseFloat(t);
  if (!Number.isNaN(n)) return Math.max(0, Math.min(1, n));
  return 0.5;
}

function inferNodeIcons(node) {
  const text = [
    node.label || '',
    node.desc || '',
    node.role || '',
    node.functionText || '',
    node.technicalText || '',
  ].join(' ').toLowerCase();
  const role = normalizeRole(node.role);
  const icons = [];
  const hasDataSignal =
    role.includes('data') ||
    role.includes('storage') ||
    role.includes('database') ||
    role.includes('personalization_store') ||
    /\b(database|knowledge graph|vector db|vector store|data lake|repository)\b/.test(text) ||
    /\bdb\b/.test(text) ||
    /\bstore\b/.test(text);
  if (hasDataSignal) icons.push('🗄️');
  const hasLlmSignal =
    /\b(llm|gpt|large language model|ai model|foundation model|genai|ai inference|inference engine)\b/.test(text);
  if (hasLlmSignal) icons.push('🤖');
  if (role.includes('input') || role.includes('sensing')) icons.push('📥');
  if (role.includes('output') || role.includes('actuation') || role.includes('presentation')) icons.push('📤');
  return Array.from(new Set(icons)).slice(0, 2);
}

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

function computeProcessingLevels(topNodes, edges, childToParent) {
  const topSet = new Set(topNodes.map(n => n.id));
  const incoming = {};
  const indegree = {};
  topNodes.forEach(n => {
    incoming[n.id] = [];
    indegree[n.id] = 0;
  });

  edges.forEach(e => {
    const srcTop = childToParent[e.source] || e.source;
    const tgtTop = childToParent[e.target] || e.target;
    if (!topSet.has(srcTop) || !topSet.has(tgtTop) || srcTop === tgtTop) return;
    incoming[tgtTop].push(srcTop);
    indegree[tgtTop] += 1;
  });

  const queue = topNodes.filter(n => indegree[n.id] === 0).map(n => n.id);
  const order = [];
  while (queue.length) {
    const cur = queue.shift();
    order.push(cur);
    edges.forEach(e => {
      const srcTop = childToParent[e.source] || e.source;
      const tgtTop = childToParent[e.target] || e.target;
      if (srcTop !== cur || !topSet.has(tgtTop) || srcTop === tgtTop) return;
      indegree[tgtTop] -= 1;
      if (indegree[tgtTop] === 0) queue.push(tgtTop);
    });
  }
  topNodes.forEach(n => {
    if (!order.includes(n.id)) order.push(n.id);
  });

  const levelMap = {};
  order.forEach(id => {
    const cur = topNodes.find(n => n.id === id);
    if (!cur || cur.lane !== 'processing') {
      levelMap[id] = 0;
      return;
    }
    const upstreamLevels = incoming[id]
      .map(up => levelMap[up] ?? 0);
    levelMap[id] = upstreamLevels.length > 0 ? Math.max(...upstreamLevels) + 1 : 1;
  });

  return levelMap;
}

function runRoleLayout(nodes, edges) {
  const positions = {};
  const topNodes = nodes.filter(n => !n.parent);
  const childToParent = {};
  const childCountMap = {};
  nodes.forEach(n => {
    if (n.parent) {
      childToParent[n.id] = n.parent;
      childCountMap[n.parent] = (childCountMap[n.parent] || 0) + 1;
    }
  });

  const levelMap = computeProcessingLevels(topNodes, edges, childToParent);
  // data lane sits at the top as a horizontal row; other lanes stack vertically in columns below
  const laneOrder = { data: 0, input: 1, processing: 2, output: 3, unknown: 4 };
  const colLaneX = { input: 80, processing: 500, output: 960, unknown: 730 };
  const rowGap = 90;
  const colGap = 60;
  const childGap = 16;
  const DATA_TOP = 40;
  const DATA_NODE_GAP = 40;

  const ordered = [...topNodes].sort((a, b) => {
    const laneDiff = (laneOrder[a.lane] ?? 4) - (laneOrder[b.lane] ?? 4);
    if (laneDiff !== 0) return laneDiff;
    const levelDiff = (levelMap[a.id] || 0) - (levelMap[b.id] || 0);
    if (levelDiff !== 0) return levelDiff;
    if ((b.importance || 0) !== (a.importance || 0)) return (b.importance || 0) - (a.importance || 0);
    return String(a.label || a.id).localeCompare(String(b.label || b.id));
  });

  // Pre-calculate sub-node dynamic heights
  const subnodeDims = {};
  nodes.filter(n => n.parent).forEach(n => {
    const innerW = Math.max(10, NODE_W - 24);
    const rawDesc = String(n.desc || '').replace(/\s+/g, ' ').trim();
    const titleLines = wrapTextToLines(n.label, innerW, 12, 'bold');
    const descLines = wrapTextToLines(rawDesc, innerW, 10, 'normal');
    const lines = descLines.length > 0 ? [...titleLines, ...descLines] : [...titleLines];
    const dynH = Math.max(NODE_H, 18 + lines.length * 12);
    subnodeDims[n.id] = { w: NODE_W, h: dynH };
  });

  // Helper: compute node height without placing it
  function computeNodeDims(n) {
    const w = n.isGroup ? GROUP_W : NODE_W;
    const innerW = Math.max(10, w - 24);
    const titleText = String(n.label || '').trim();
    const rawDesc = String(n.desc || '').replace(/\s+/g, ' ').trim();
    let h = NODE_H;
    let overlayTop = 0;
    if (n.isGroup) {
      const titleLines = wrapTextToLines(titleText, innerW, 12, 'bold');
      const descLines = wrapTextToLines(rawDesc, innerW, 10, 'normal');
      const titleH = Math.max(18, titleLines.length * 14);
      const descH = descLines.length > 0 ? descLines.length * 12 : 0;
      overlayTop = 10 + titleH + (descH ? 6 + descH : 0);
      const childTop = overlayTop + 16;
      const groupChildren = nodes.filter(c => c.parent === n.id).sort((a, b) => String(a.id).localeCompare(String(b.id)));
      let childrenTotalH = 0;
      groupChildren.forEach((c, idx) => {
        childrenTotalH += subnodeDims[c.id].h;
        if (idx < groupChildren.length - 1) childrenTotalH += childGap;
      });
      h = Math.max(160, childTop + childrenTotalH + 24);
    } else {
      const titleLines = wrapTextToLines(titleText, innerW, 13, 'bold');
      const descLines = wrapTextToLines(rawDesc, innerW, 11, 'normal');
      const gap = 12;
      const titleH = Math.max(18, titleLines.length * 16);
      const descH = descLines.length > 0 ? Math.max(12, descLines.length * 14) : 0;
      h = Math.max(NODE_H, 20 + titleH + (descH ? gap + descH : 0) + 10);
    }
    return { w, h, overlayTop };
  }

  // First pass: compute heights for all top nodes
  const nodeDims = {};
  ordered.forEach(n => { nodeDims[n.id] = computeNodeDims(n); });

  // Compute data row height (tallest data node) so columns start below it
  const dataNodes = ordered.filter(n => n.lane === 'data');
  const dataRowH = dataNodes.length > 0
    ? Math.max(...dataNodes.map(n => nodeDims[n.id].h))
    : 0;
  const COL_TOP = dataNodes.length > 0 ? DATA_TOP + dataRowH + rowGap : DATA_TOP;

  // Place data nodes horizontally across the top, centered over the column area
  const colLanes = ['input', 'processing', 'output', 'unknown'];
  const colXValues = colLanes.map(l => colLaneX[l]);
  const layoutLeft = Math.min(...colXValues);
  const layoutRight = Math.max(...colXValues) + NODE_W;
  const layoutWidth = layoutRight - layoutLeft;

  if (dataNodes.length > 0) {
    const totalDataW = dataNodes.reduce((sum, n) => sum + nodeDims[n.id].w, 0)
      + DATA_NODE_GAP * (dataNodes.length - 1);
    let dataX = layoutLeft + (layoutWidth - totalDataW) / 2;
    dataNodes.forEach(n => {
      const { w, h, overlayTop } = nodeDims[n.id];
      positions[n.id] = { x: dataX, y: DATA_TOP, w, h, overlayTop };
      dataX += w + DATA_NODE_GAP;
    });
  }

  // Place column-lane nodes (input / processing / output / unknown) stacking vertically
  const laneY = { input: COL_TOP, processing: COL_TOP, output: COL_TOP, unknown: COL_TOP };

  ordered.filter(n => n.lane !== 'data').forEach(n => {
    const lane = n.lane || 'unknown';
    const level = levelMap[n.id] || 0;
    // processing nodes offset slightly right per level to show depth, capped to avoid overlap
    const maxOffset = (colLaneX['output'] - colLaneX['processing'] - GROUP_W - colGap);
    const x = (colLaneX[lane] ?? colLaneX.unknown) + (lane === 'processing' ? Math.min(level * 30, Math.max(0, maxOffset)) : 0);
    const { w, h, overlayTop } = nodeDims[n.id];
    positions[n.id] = { x, y: laneY[lane], w, h, overlayTop };
    laneY[lane] += h + rowGap;
  });

  nodes.filter(n => n.parent).forEach((n) => {
    const parentPos = positions[n.parent] || { x: 0, y: 0, w: GROUP_W, h: 160, overlayTop: 60 };
    const siblings = nodes.filter(s => s.parent === n.parent).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const overlayTop = parentPos.overlayTop || 60;
    const padding = 16;

    let currentY = parentPos.y + overlayTop + padding;
    for (let i = 0; i < siblings.length; i++) {
      const s = siblings[i];
      if (s.id === n.id) {
        break;
      }
      currentY += (subnodeDims[s.id]?.h || NODE_H) + childGap;
    }
    positions[n.id] = {
      x: parentPos.x + (parentPos.w - NODE_W) / 2,
      y: currentY,
      w: NODE_W,
      h: subnodeDims[n.id]?.h || NODE_H,
    };
  });

  return { positions, levelMap };
}

// ─── JSON → graph nodes/edges ─────────────────────────────────────────────────
function parseNodeDetails(nodeDetails) {
  const nodes = [];
  const edges = [];
  const isOverlayId = (val) => {
    const id = String(val || '');
    return id.endsWith('__hdr') || id.endsWith('__sub') || id.endsWith('__ico');
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
      const role = mod.role || '';
      const lane = getRoleLane(role);
      const importance = parseImportance(mod.importance ?? mod.priority ?? mod.criticality ?? mod.weight);
      nodes.push({
        id: modName,
        label: mod.name || modName,
        desc: mod.brief_description || '',
        isGroup: true,
        parent: null,
        role,
        lane,
        importance,
        functionText: mod.function || '',
        technicalText: mod.technical_methods || '',
      });
      mod.sub_nodes.forEach((sn, sIdx) => {
        const snId =
          (sn.id && String(sn.id).trim()) ||
          (sn.name && String(sn.name).trim()) ||
          `${modName}_sub_${sIdx + 1}`;
        nodes.push({
          id: snId,
          label: sn.name || snId,
          desc: sn.brief_description || '',
          isGroup: false,
          parent: modName,
          role,
          lane,
          importance,
          functionText: sn.function || '',
          technicalText: sn.technical_methods || '',
        });
      });
    } else {
      const role = mod.role || '';
      const lane = getRoleLane(role);
      const importance = parseImportance(mod.importance ?? mod.priority ?? mod.criticality ?? mod.weight);
      nodes.push({
        id: modName,
        label: mod.name || modName,
        desc: mod.brief_description || '',
        isGroup: false,
        parent: null,
        role,
        lane,
        importance,
        functionText: mod.function || '',
        technicalText: mod.technical_methods || '',
      });
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
    if (id.endsWith('__ico')) {
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
    if (nodeId.endsWith('__hdr') || nodeId.endsWith('__sub') || nodeId.endsWith('__ico')) return;
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
        let childLabel = childNode?.attr('label/text') || childNode?.getProp('label') || childId;
        // The text might contain both name and description separated by newline. Only take the first line as name.
        if (childLabel && typeof childLabel === 'string') {
          childLabel = childLabel.split('\n')[0].trim();
        }
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
  try { graph.resetCells([]); } catch (e) { void e; }
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
    const layout = runRoleLayout(parsedNodes, parsedEdges);
    positions = layout.positions;
  } catch (e) {
    console.error('Layout error:', e);
    parsedNodes.forEach((n, i) => { positions[n.id] = { x: (i % 5) * 260, y: Math.floor(i / 5) * 100, w: NODE_W, h: NODE_H }; });
  }

  const colorOf = (n) => ROLE_THEME[n.lane] || ROLE_THEME.unknown;

  const portsDef = (id, lane = 'unknown') => {
    const color = (ROLE_THEME[lane] || ROLE_THEME.unknown).stroke;
    return ({
      groups: {
        top: { position: 'top', attrs: { circle: { r: 4, magnet: true, stroke: color, fill: '#fff', strokeWidth: 1.5 } } },
        bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: color, fill: '#fff', strokeWidth: 1.5 } } },
        left: { position: 'left', attrs: { circle: { r: 4, magnet: true, stroke: color, fill: '#fff', strokeWidth: 1.5 } } },
        right: { position: 'right', attrs: { circle: { r: 4, magnet: true, stroke: color, fill: '#fff', strokeWidth: 1.5 } } },
      },
      items: [
        { id: `${id}-top`, group: 'top' },
        { id: `${id}-bottom`, group: 'bottom' },
        { id: `${id}-left`, group: 'left' },
        { id: `${id}-right`, group: 'right' },
      ],
    });
  };

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
    const theme = colorOf(n);
    const icons = inferNodeIcons(n);
    const iconText = icons.join(' ');
    const titleText = n.label;
    const innerW = Math.max(10, pos.w - 24);
    const titleLines = wrapTextToLines(titleText, innerW, 12, 'bold');
    const rawDesc = (n.desc || '').replace(/\s+/g, ' ').trim();
    const descLines = wrapTextToLines(rawDesc, innerW, 10, 'normal');
    const titleH = Math.max(18, titleLines.length * 14);
    const descH = descLines.length > 0 ? descLines.length * 12 : 0;
    const overlayTop = 10 + titleH + (descH ? 6 + descH : 0);
    overlayTopMap[n.id] = overlayTop;
    const group = graph.addNode({
      id: n.id, shape: 'rect', x: pos.x, y: pos.y, width: pos.w, height: pos.h, zIndex: 0,
      attrs: {
        body: { fill: theme.fill, stroke: theme.stroke, strokeWidth: 2.2, strokeDasharray: '6 3', rx: 10, ry: 10 },
        label: { text: '', fontSize: 12, fontWeight: 'bold', fill: theme.text, refX: 0.5, refY: 0.5, textAnchor: 'middle', textVerticalAnchor: 'middle' },
      },
      ports: portsDef(n.id, n.lane),
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
        label: { text: titleLines.join('\n'), fontSize: 12, fontWeight: 'bold', fill: theme.text, textAnchor: 'middle', textVerticalAnchor: 'top', refX: 0.5, refY: 0, pointerEvents: 'none' },
      },
      ports: { groups: {}, items: [] },
    });
    const iconNode = iconText ? graph.addNode({
      id: `${n.id}__ico`,
      shape: 'rect',
      x: pos.x + pos.w - 38,
      y: pos.y + 8,
      width: 26,
      height: 22,
      zIndex: 6,
      attrs: {
        body: { fill: 'transparent', stroke: 'transparent', pointerEvents: 'none' },
        label: { text: iconText, fontSize: 18, fill: theme.text, textAnchor: 'middle', textVerticalAnchor: 'middle', refX: 0.5, refY: 0.5, pointerEvents: 'none' },
      },
      ports: { groups: {}, items: [] },
    }) : null;
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
    if (iconNode) group.addChild(iconNode);
    group.addChild(descNode);
    group.resize(pos.w, Math.max(pos.h, overlayTop + 80));
  });

  // Leaf nodes
  parsedNodes.filter(n => !n.isGroup).forEach(n => {
    const pos = positions[n.id] || { x: 0, y: 0, w: NODE_W, h: NODE_H };
    const theme = colorOf(n);
    const oy = 0;
    const isTopLevelLeaf = !n.parent;
    if (isTopLevelLeaf) {
      const icons = inferNodeIcons(n);
      const iconText = icons.join(' ');
      const titleText = n.label;
      const innerW = Math.max(10, pos.w - 24);
      const rawDesc = (n.desc || '').replace(/\s+/g, ' ').trim();
      const titleLines = wrapTextToLines(titleText, innerW, 13, 'bold');
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
          body: { fill: theme.fill, stroke: theme.stroke, strokeWidth: 2.2, strokeDasharray: '6 3', rx: 10, ry: 10 },
          label: { text: '', fontSize: 12, fill: theme.text, textAnchor: 'middle', textVerticalAnchor: 'middle', refX: 0.5, refY: 0.5 },
        },
        ports: portsDef(n.id, n.lane),
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
          label: { text: titleLines.join('\n'), fontSize: 13, fontWeight: 'bold', fill: theme.text, textAnchor: 'middle', textVerticalAnchor: 'top', refX: 0.5, refY: 0, pointerEvents: 'none' },
        },
        ports: { groups: {}, items: [] },
      });
      const iconNode = iconText ? graph.addNode({
        id: `${n.id}__ico`,
        shape: 'rect',
        x: pos.x + pos.w - 38,
        y: pos.y + oy + 8,
        width: 26,
        height: 22,
        zIndex: 6,
        attrs: {
          body: { fill: 'transparent', stroke: 'transparent', pointerEvents: 'none' },
          label: { text: iconText, fontSize: 19, fill: theme.text, textAnchor: 'middle', textVerticalAnchor: 'middle', refX: 0.5, refY: 0.5, pointerEvents: 'none' },
        },
        ports: { groups: {}, items: [] },
      }) : null;
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
      if (iconNode) group.addChild(iconNode);
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
          body: { fill: theme.light, stroke: theme.stroke, strokeWidth: 1.6 + (n.importance || 0) * 0.9, rx: 6, ry: 6 },
          label: { text: labelText, fontSize: 11, fill: '#333', textAnchor: 'middle', textVerticalAnchor: 'middle', refX: 0.5, refY: 0.5 },
        },
        ports: portsDef(n.id, n.lane),
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
  const edgeLabelOffsets = [0, 16, -16, 28, -28, 40, -40];
  parsedEdges.forEach((e, idx) => {
    const labelOffset = edgeLabelOffsets[idx % edgeLabelOffsets.length];
    const labels = e.label
      ? [{
        attrs: {
          label: { text: e.label, fontSize: 11, fontWeight: 600, fill: '#475569' },
        },
        position: { distance: 0.5, offset: labelOffset },
      }]
      : [];
    graph.addEdge({
      id: e.id, source: e.source, target: e.target, dashed: e.dashed, zIndex: 2,
      router: { name: 'orth' },
      connector: { name: 'rounded', args: { radius: 12 } },
      attrs: {
        line: {
          stroke: e.dashed ? '#9aa7b8' : '#7b8ea6',
          strokeWidth: e.dashed ? 1.35 : 1.55,
          strokeDasharray: e.dashed ? '7 5' : '0',
          targetMarker: { name: 'block', size: 8, fill: e.dashed ? '#9aa7b8' : '#7b8ea6' },
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
  const lastInternalSigRef = useRef('');
  const nodeDetailsRef = useRef(nodeDetails);
  const onNodeClickRef = useRef(onNodeClick);
  const onPaneClickRef = useRef(onPaneClick);
  const onNodeDetailsChangeRef = useRef(onNodeDetailsChange);
  const pendingRenderRef = useRef(null);  // Queues data that arrived before graph was ready
  nodeDetailsRef.current = nodeDetails;
  onNodeClickRef.current = onNodeClick;
  onPaneClickRef.current = onPaneClick;
  onNodeDetailsChangeRef.current = onNodeDetailsChange;

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
        connector: { name: 'rounded', args: { radius: 12 } },
        anchor: 'center',
        connectionPoint: 'boundary',
        allowBlank: false,
        allowLoop: false,
        highlight: true,
        createEdge() {
          return new Shape.Edge({
            attrs: { line: { stroke: '#7b8ea6', strokeWidth: 1.55, targetMarker: { name: 'block', size: 8, fill: '#7b8ea6' } } },
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
    const emitNodeDetailsChange = (g) => {
      if (!g || !onNodeDetailsChangeRef.current || isRenderingRef.current) return;
      const nextDetails = graphToNodeDetails(g, nodeDetailsRef.current);
      let sig = '';
      try {
        sig = JSON.stringify(nextDetails);
      } catch (e) { void e; }
      if (sig) lastInternalSigRef.current = sig;
      isInternalUpdateRef.current = true;
      onNodeDetailsChangeRef.current(nextDetails);
    };
    const syncOverlayLayout = (parentNode) => {
      if (!parentNode || !(parentNode.isNode && parentNode.isNode())) return;
      const id = String(parentNode.id || '');
      if (!id || id.endsWith('__hdr') || id.endsWith('__sub') || id.endsWith('__ico')) return;
      const data = parentNode.getData ? parentNode.getData() : {};
      if (!data || typeof data.overlayTop !== 'number') return;
      const hdr = graph.getCellById(`${id}__hdr`);
      const sub = graph.getCellById(`${id}__sub`);
      const ico = graph.getCellById(`${id}__ico`);
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
      if (ico) ico.position(pb.x + pb.width - 38, pb.y + 8);
      sub.position(pb.x + 12, pb.y + 10 + titleH + 6);
      sub.resize(innerW, descH || 12);
      sub.attr('label/text', descLines.join('\n'));
      try { parentNode.setData && parentNode.setData({ ...data, overlayTop }); } catch (e) { void e; }
      const minH = overlayTop + 80;
      if (pb.height < minH) parentNode.resize(pb.width, minH);
    };
    graph.on('node:change:position', ({ node }) => {
      const id = String(node?.id || '');
      if (id.endsWith('__hdr') || id.endsWith('__sub') || id.endsWith('__ico')) return;
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
    graph.on('node:click', ({ node }) => { if (onNodeClickRef.current) onNodeClickRef.current(node.id); });
    graph.on('blank:click', () => { if (onPaneClickRef.current) onPaneClickRef.current(); });
    graph.on('node:dblclick', ({ node, e }) => {
      e.stopPropagation();
      if (isRenderingRef.current) return;

      let targetId = String(node.id || '');
      if (targetId.endsWith('__hdr') || targetId.endsWith('__sub') || targetId.endsWith('__ico')) {
        targetId = targetId.slice(0, -5);
      }

      const baseNode = graph.getCellById(targetId) || node;
      const hdrCell = graph.getCellById(`${targetId}__hdr`);

      let cur = '';
      if (hdrCell) {
        cur = String(hdrCell.attr('label/text') || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      } else {
        cur = baseNode.attr('label/text') || baseNode.getProp('label') || baseNode.id;
        // strip out description if it's a sub-node
        const lines = cur.split('\n');
        if (lines.length > 0) cur = lines[0]; // simplistic heuristic
      }

      const next = window.prompt('重命名节点:', cur);
      if (next !== null && next.trim() && next.trim() !== cur) {
        const newName = next.trim();

        if (hdrCell) {
          hdrCell.attr('label/text', newName); // raw text
          try { syncOverlayLayout(baseNode); } catch (ex) { console.error(ex); }
        } else {
          // Standard node without hdrcell
          let dynText = newName;
          try {
            const innerW = Math.max(10, baseNode.getSize().width - 24);
            const details = nodeDetailsRef.current || {};
            let origNode = details[targetId];
            if (!origNode) {
              // maybe it's inside a group
              Object.values(details).forEach(m => {
                if (m.sub_nodes) {
                  const child = m.sub_nodes.find(sn => sn.id === targetId || sn.name === targetId);
                  if (child) origNode = child;
                }
              });
            }
            const rawDesc = origNode ? (origNode.brief_description || origNode.desc || '') : '';
            const titleLines = wrapTextToLines(newName, innerW, 12, 'bold');
            const descLines = wrapTextToLines(rawDesc.replace(/\s+/g, ' ').trim(), innerW, 10, 'normal');
            dynText = descLines.length > 0 ? [...titleLines, ...descLines].join('\n') : titleLines.join('\n');
          } catch (e) { void e; }
          baseNode.attr('label/text', dynText);
        }

        const g = graphRef.current;
        emitNodeDetailsChange(g);
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
          edge.setLabels([{ attrs: { label: { text, fontSize: 11, fontWeight: 600, fill: '#475569' } }, position: { distance: 0.5, offset: 12 } }]);
        } else {
          edge.setLabels([]);
        }
      }
      const g = graphRef.current;
      emitNodeDetailsChange(g);
    });
    graph.on('node:removed', ({ node }) => {
      if (isRenderingRef.current) return;
      const g = graphRef.current;
      if (!g) return;
      try {
        const id = String(node?.id || '');
        if (!id.endsWith('__hdr') && !id.endsWith('__sub') && !id.endsWith('__ico')) {
          const hdr = g.getCellById(`${id}__hdr`);
          const sub = g.getCellById(`${id}__sub`);
          const ico = g.getCellById(`${id}__ico`);
          const toRemove = [];
          if (hdr) toRemove.push(hdr);
          if (sub) toRemove.push(sub);
          if (ico) toRemove.push(ico);
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
              return c.isNode && c.isNode() && !cid.endsWith('__hdr') && !cid.endsWith('__sub') && !cid.endsWith('__ico');
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
      emitNodeDetailsChange(g);
    });
    graph.on('edge:added', ({ edge }) => {
      if (isRenderingRef.current) return;
      const has = edge.getLabels?.() && edge.getLabels().length > 0;
      if (!has) {
        const t = window.prompt('设置连线标签(可选):', '');
        if (t && t.trim()) {
          edge.setLabels([{ attrs: { label: { text: t.trim(), fontSize: 11, fontWeight: 600, fill: '#475569' } }, position: { distance: 0.5, offset: 12 } }]);
        }
      }
      const g = graphRef.current;
      emitNodeDetailsChange(g);
    });
    graph.on('edge:removed', () => {
      if (isRenderingRef.current) return;
      const g = graphRef.current;
      emitNodeDetailsChange(g);
    });
    graph.bindKey(['backspace', 'delete'], () => {
      if (isRenderingRef.current) return;
      const cells = graph.getSelectedCells();
      if (cells.length) {
        graph.removeCells(cells);
        const g = graphRef.current;
        emitNodeDetailsChange(g);
      }
    });
    return graph;
  }, []);

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
    if (!graph || !onNodeDetailsChangeRef.current) return;
    if (isRenderingRef.current) return;
    const nextDetails = graphToNodeDetails(graph, nodeDetailsRef.current);
    let sig = '';
    try {
      sig = JSON.stringify(nextDetails);
    } catch (e) { void e; }
    if (sig) lastInternalSigRef.current = sig;
    isInternalUpdateRef.current = true;
    onNodeDetailsChangeRef.current(nextDetails);
  }, []);

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
    let incomingSig = '';
    try {
      incomingSig = JSON.stringify(nodeDetails);
    } catch (e) { void e; }
    const isInternalEcho = !!incomingSig && incomingSig === lastInternalSigRef.current;
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      if (isInternalEcho) return;
    }
    if (!graphReadyRef.current || !graphRef.current) {
      pendingRenderRef.current = nodeDetails;
      return;
    }
    isRenderingRef.current = true;
    try {
      renderGraph(graphRef.current, nodeDetails);
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
    const descLines = wrapTextToLines((brief || '').trim(), innerW, 11, 'normal');
    const gap = 12;
    const titleH = Math.max(18, titleLines.length * 16);
    const descH = descLines.length > 0 ? Math.max(12, descLines.length * 14) : 0;
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
          top: { position: 'top', attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
          bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
          left: { position: 'left', attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
          right: { position: 'right', attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
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
          top: { position: 'top', attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
          bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
          left: { position: 'left', attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
          right: { position: 'right', attrs: { circle: { r: 4, magnet: true, stroke: '#217cf3', fill: '#fff', strokeWidth: 1.5 } } },
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
        <button title="放大" onClick={() => graphRef.current?.zoom(0.1)} style={btnStyle}>+</button>
        <button title="缩小" onClick={() => graphRef.current?.zoom(-0.1)} style={btnStyle}>−</button>
        <button title="适应画布" onClick={() => graphRef.current?.zoomToFit({ padding: 40, maxScale: 1.2 })} style={btnStyle}>⊡</button>
        <button title="添加节点" onClick={handleAddNode} style={{ ...btnStyle, backgroundColor: '#217cf3', color: '#fff', borderColor: '#217cf3' }}>+ 模块</button>
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
