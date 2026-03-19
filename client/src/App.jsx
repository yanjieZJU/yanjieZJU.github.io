// client/src/App.jsx
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import X6FlowViewer from './X6FlowViewer';
import './App.css';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : '/api';

// Extract top N processing modules from node_details for plan preview
function getProcessingModules(nodeDetails, maxCount = 3) {
  if (!nodeDetails) return [];
  const entries = Array.isArray(nodeDetails)
    ? nodeDetails.map(m => [m.id || m.name, m])
    : Object.entries(nodeDetails);
  const processing = entries
    .map(([, m]) => m)
    .filter(m => {
      const role = String(m.role || '').toLowerCase();
      return role.includes('processing') || role.includes('core') || role.includes('inference') || role.includes('reasoning');
    });
  return processing.slice(0, maxCount).map(m => m.name || m.id || '');
}

// Get first sentence of a description string
function firstSentence(text) {
  if (!text) return '';
  const m = String(text).match(/^[^。！？.!?]+[。！？.!?]?/);
  return m ? m[0].trim() : String(text).slice(0, 60);
}

// 初始节点
const initialNodes = [];
const initialEdges = [];

function App() {
  const [description, setDescription] = useState('');
  const [sessionId, setSessionId] = useState(''); // Added session ID

  // 使用 React Flow 的 hook 管理状态
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [newNodeName, setNewNodeName] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('开始生成...'); // 进度条状态

  // 多方案状态
  const [plans, setPlans] = useState([]); // 存储所有返回的方案
  const [activePlanIndex, setActivePlanIndex] = useState(0); // 当前激活的方案索引
  const [isMorePerspectivesOpen, setIsMorePerspectivesOpen] = useState(false);
  const plansRef = useRef(plans);
  const nodeDetailsSigRef = useRef('');

  const [nodeDetails, setNodeDetails] = useState({}); // 存储后端返回的节点详细信息
  const resolvedNodeDetails = useMemo(() => {
    const hasNodeDetails = Array.isArray(nodeDetails)
      ? nodeDetails.length > 0
      : !!(nodeDetails && Object.keys(nodeDetails).length > 0);
    if (hasNodeDetails) return nodeDetails;
    const currentPlan = plans[activePlanIndex];
    const fromPlan = currentPlan?.node_details ?? currentPlan?.module_details;
    if (typeof fromPlan !== 'undefined') return fromPlan;
    return nodeDetails;
  }, [nodeDetails, plans, activePlanIndex]);
  const detailsRef = useRef(resolvedNodeDetails);
  useEffect(() => {
    detailsRef.current = resolvedNodeDetails;
  }, [resolvedNodeDetails]);
  
  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  useEffect(() => {
    const currentPlan = plansRef.current[activePlanIndex];
    if (currentPlan) {
      const detailsFromPlan = currentPlan.node_details ?? currentPlan.module_details;
      console.log('Syncing plan to UI:', activePlanIndex, currentPlan, 'detailsFromPlan:', detailsFromPlan ? 'present' : 'absent');
      if (typeof detailsFromPlan !== 'undefined') {
        let sig = '';
        try {
          sig = JSON.stringify(detailsFromPlan);
        } catch (e) { void e; }
        if (!sig || sig !== nodeDetailsSigRef.current) {
          nodeDetailsSigRef.current = sig;
          setNodeDetails(detailsFromPlan);
        }
      }
      setSelectedNodeInfo(null);
    }
  }, [activePlanIndex]);

  // React Flow 实例
  const reactFlowWrapper = useRef(null);
  const resultFlowRef = useRef(null); // Ref for the right panel viewer

  const [selectedNodeInfo, setSelectedNodeInfo] = useState(null); // 当前选中节点的信息
  const [nodeDetailDraft, setNodeDetailDraft] = useState({ function: '', technical_methods: '' });
  const [isNodeDetailEditing, setIsNodeDetailEditing] = useState(false);

  // 新增节点详情弹窗状态
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [modalNodeData, setModalNodeData] = useState({ id: null, label: '', description: '', role: '' });

  const [editingNodeId, setEditingNodeId] = useState(null); // 当前正在编辑名称的节点ID
  const [editingNodeLabel, setEditingNodeLabel] = useState(''); // 当前编辑的名称

  const [modificationInput, setModificationInput] = useState(''); // 修改需求的输入

  const [viewMode, setViewMode] = useState('edit'); // 'edit' = 编辑模式, 'result' = 方案全屏展示模式

  // 添加测试
  const [testJsonStr, setTestJsonStr] = useState('');
  const [planThumbnails, setPlanThumbnails] = useState({});

  const handleTestJson = () => {
    try {
      const json = JSON.parse(testJsonStr);
      let details;
      if (json.module_details) {
        details = json.module_details;
      } else {
        details = json;
      }

      // 创建完整的计划对象，包括必要的字段
      const testPlan = {
        perspective: json.perspective || '快速测试版',
        description: json.overall_description || json.description || '测试生成的方案',
        node_details: details,
        mermaid_code: json.mermaid_code || '',
        // 添加必要的字段以匹配正常的计划结构
        plan_id: json.plan_id || `test-plan-${Date.now()}`,
        history: json.history || [],
        used_references: json.used_references || {}
      };

      setPlans([testPlan]);
      setActivePlanIndex(0);
      setNodeDetails(details);
      setViewMode('result');
      setTestJsonStr('');
    } catch (err) {
      alert("JSON 解析失败: " + err.message);
    }
  };
  // End

  // --- React Flow 事件处理 ---

  // 节点点击事件
  const onNodeClick = useCallback((event, node) => {
    event.stopPropagation(); // 防止触发 onPaneClick
    // 查找该节点的详细信息
    // node.data.label 是节点显示的名称
    const label = node.data.label;
    if (label && nodeDetails[label]) {
      setSelectedNodeInfo(nodeDetails[label]);
    } else {
      setSelectedNodeInfo({ name: label, description: '暂无详细描述' });
    }
  }, [nodeDetails]);

  // 连线事件
  const onConnect = useCallback((params) => {
    console.log('Connect:', params);
    setEdges((eds) => addEdge({
      ...params,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      // 允许交互（选中、删除）
      interactionWidth: 20,
    }, eds));
  }, [setEdges]);

  // 双击连线删除
  const onEdgeDoubleClick = useCallback((event, edge) => {
    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
  }, [setEdges]);

  // 拖拽结束事件：处理“包含关系”
  const onNodeDragStop = useCallback((event, node) => {
    // 获取拖拽节点的位置和尺寸（大致估算，或者从 node.width/height 获取如果已测量）
    // React Flow 默认不直接提供 width/height 除非已渲染并测量，但我们可以尝试获取
    // 这里简化逻辑：检查中心点是否在另一个节点内

    // 获取所有节点（除了自己）
    const otherNodes = nodes.filter(n => n.id !== node.id);

    // 计算当前节点的中心点
    // 注意：node.position 是相对于父级的。如果已经是子节点，需要累加父级坐标才能得到绝对坐标用于检测
    // 但为了简化，我们假设第一层检测是基于绝对位置的，或者我们只支持单层嵌套（Level 1 -> Level 2）

    // 获取当前节点的绝对位置（如果它已经在某个父节点下，这个逻辑会复杂一点，
    // 这里简化为：只处理从顶层拖入某个节点，或者从某个节点拖回顶层）

    // 简单的碰撞检测逻辑
    // 假设节点大小大概是 150x40 (根据样式)
    const nodeWidth = node.width || 150;
    const nodeHeight = node.height || 40;
    const centerX = node.position.x + nodeWidth / 2;
    const centerY = node.position.y + nodeHeight / 2;

    let targetParent = null;

    // 遍历其他节点，寻找潜在的父节点
    // 注意：我们只允许成为“非子节点”的节点的子节点，防止无限嵌套或复杂逻辑
    for (const other of otherNodes) {
      // 忽略已经是子节点的节点作为父节点（简化）
      if (other.parentNode) continue;

      const otherWidth = other.width || 150;
      const otherHeight = other.height || 40;

      // 检查是否重叠（包含）
      // 严格一点：要求中心点在父节点范围内
      // 或者：如果父节点现在是“扩大”状态，它的实际渲染尺寸可能比原始尺寸大。
      // React Flow 的 node.width/height 通常是上次渲染的尺寸。
      // 如果我们手动修改了 style.width/height，React Flow 的内部测量可能还没更新。
      // 所以我们优先使用 style 中的尺寸（如果存在）
      const styleWidth = other.style?.width ? parseInt(other.style.width) : otherWidth;
      const styleHeight = other.style?.height ? parseInt(other.style.height) : otherHeight;

      if (
        centerX > other.position.x &&
        centerX < other.position.x + styleWidth &&
        centerY > other.position.y &&
        centerY < other.position.y + styleHeight
      ) {
        targetParent = other;
        break;
      }
    }

    if (targetParent) {
      console.log(`Node ${node.id} dropped into ${targetParent.id}`);

      // 如果已经是这个父节点的子节点，不需要做父子关系的变更，但可能需要更新相对位置
      // 但 React Flow 的 onNodeDragStop 默认是在拖拽结束后触发，
      // 如果节点已经是子节点，拖拽时它的 position 已经是相对于父节点的。
      // 如果我们在这里重新计算，可能会导致跳动。
      // 所以：如果已经是该父节点的子节点，并且仍在父节点范围内，我们只需要确认它还在里面即可。

      if (node.parentNode === targetParent.id) {
        // 已经在里面了，不需要做任何结构性变更
        // 但我们需要检查是否移出了（上面的 targetParent 逻辑已经涵盖了“在里面”）
        // 所以如果能走到这里，说明还在范围内。
        return;
      }

      // 更新节点：设置为子节点
      setNodes((nds) => {
        // 先计算，如果这个父节点已经有其他子节点，或者即将有这个新子节点
        // 这里逻辑稍微复杂一点：我们需要知道父节点是否有 *其他* 子节点。
        // 但其实更简单的逻辑是：只要有子节点加入，父节点就变大；
        // 只要子节点离开，我们再检查父节点是否还有剩余子节点。

        return nds.map((n) => {
          // 处理被拖入的子节点：缩小并建立父子关系
          if (n.id === node.id) {
            // 计算相对坐标
            const relativeX = node.position.x - targetParent.position.x;
            const relativeY = node.position.y - targetParent.position.y;

            return {
              ...n,
              parentNode: targetParent.id,
              position: { x: relativeX, y: relativeY },
              extent: 'parent', // 限制在父节点范围内 (可选)
              // 修改样式：缩小
              style: {
                ...n.style,
                zIndex: 10,
                width: 100,
                height: 40,
                fontSize: '12px'
              }
            };
          }

          // 处理父节点：扩大并改变外观以表示包含
          if (n.id === targetParent.id) {
            const currentWidth = parseInt(n.style?.width || 150);
            const currentHeight = parseInt(n.style?.height || 40);

            const minParentWidth = 250;
            const minParentHeight = 150;

            return {
              ...n,
              style: {
                ...n.style,
                width: Math.max(currentWidth, minParentWidth),
                height: Math.max(currentHeight, minParentHeight),
                backgroundColor: 'rgba(240, 240, 240, 0.5)',
                borderStyle: 'dashed',
              }
            };
          }

          return n;
        });
      });
    } else {
      // 如果没有落在任何节点内
      // 检查当前节点是否有父节点
      if (node.parentNode) {
        // 获取父节点对象（为了坐标转换）
        // 关键逻辑：
        // 如果节点有父节点，但 targetParent 为空，说明节点被拖出了父节点范围。
        // 此时应该执行“脱离父节点”的操作。

        console.log(`Node ${node.id} moved out of parent ${node.parentNode}`);
        const oldParentId = node.parentNode;

        // 恢复为顶层节点
        setNodes((nds) => {
          // 注意：在 setNodes 回调中获取最新的 parent 可能更安全
          // 但 node.parentNode 已经是已知的
          const currentParent = nds.find(p => p.id === oldParentId);
          if (!currentParent) return nds;

          // 检查父节点是否还有其他子节点
          const hasOtherChildren = nds.some(n => n.parentNode === oldParentId && n.id !== node.id);

          return nds.map(n => {
            // 1. 恢复子节点
            if (n.id === node.id) {
              // 坐标转换：相对 -> 绝对
              // 子节点的 position 是相对的
              // 但 React Flow 的 onNodeDragStop 传递的 node.position 是拖拽后的位置
              // 如果 extent='parent'，它会被限制在父节点内；如果没限制，它可以是负数或超出范围
              // 我们的逻辑是：一旦拖出（targetParent 为 null），就转换坐标。

              // 新的绝对坐标 = 父节点绝对坐标 + 子节点相对坐标
              const newAbsX = currentParent.position.x + node.position.x;
              const newAbsY = currentParent.position.y + node.position.y;

              return {
                ...n,
                parentNode: undefined,
                position: {
                  x: newAbsX,
                  y: newAbsY
                },
                extent: undefined,
                // 恢复默认样式
                style: {
                  ...n.style,
                  width: 150,
                  height: 40,
                  fontSize: undefined,
                  backgroundColor: '#fff',
                  borderStyle: 'solid',
                }
              };
            }

            // 2. 如果父节点没有其他子节点了，恢复父节点样式
            if (n.id === oldParentId && !hasOtherChildren) {
              return {
                ...n,
                style: {
                  ...n.style,
                  width: 150,
                  height: 40,
                  backgroundColor: '#fff',
                  borderStyle: 'solid',
                }
              };
            }

            return n;
          });
        });
      }
    }
  }, [nodes, setNodes]);


  // 打开弹窗准备添加新节点
  const openAddNodeModal = () => {
    setModalNodeData({ id: null, label: newNodeName.trim(), description: '', role: '' });
    setIsNodeModalOpen(true);
  };

  // 保存（新增/编辑）弹窗中的节点信息
  const handleSaveNodeModal = () => {
    if (!modalNodeData.label.trim()) return;

    if (modalNodeData.id) {
      // 更新现有节点
      setNodes((nds) => nds.map((node) => {
        if (node.id === modalNodeData.id) {
          return {
            ...node,
            data: {
              ...node.data,
              label: modalNodeData.label.trim(),
              description: modalNodeData.description.trim(),
              role: modalNodeData.role.trim()
            }
          };
        }
        return node;
      }));
    } else {
      // 插入新节点
      const newNodeId = `node-${Date.now()}`;
      const newNode = {
        id: newNodeId,
        data: {
          label: modalNodeData.label.trim(),
          description: modalNodeData.description.trim(),
          role: modalNodeData.role.trim()
        },
        position: {
          x: Math.random() * 200 + 50,
          y: Math.random() * 200 + 50
        },
        type: 'default',
        style: { background: '#fff', border: '1px solid #777', padding: '10px', borderRadius: '5px', width: 150 }
      };

      setNodes((nds) => [...nds, newNode]);
      setNewNodeName('');
    }
    setIsNodeModalOpen(false);
  };

  const removeNode = (id) => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
  };

  const clearNodes = () => {
    setNodes([]);
    setEdges([]);
    setNewNodeName('');
    setNodeDetails({});
    setSelectedNodeInfo(null);
    setPlans([]);
    setActivePlanIndex(0);
    setViewMode('edit');
  };



  const handleGenerate = async () => {
    console.log('[DEBUG] handleGenerate called, description:', description, 'nodes:', nodes.length);
    if (!description && nodes.length === 0) { console.log('[DEBUG] early return — empty'); return; }
    setLoading(true);
    setProgress(0);
    setPlans([]);
    setNodeDetails({});
    setProgressText('开始生成...');
    try {
      const anchorsPayload = nodes.map(n => ({
        user_term: n.data.label,
        description: n.data.description || "",
        role: n.data.role || ""
      }));

      const relationsPayload = edges.map(e => {
        const sourceNode = nodes.find(n => n.id === e.source);
        const targetNode = nodes.find(n => n.id === e.target);
        if (sourceNode && targetNode) {
          return {
            source: sourceNode.data.label,
            target: targetNode.data.label,
            type: "FLOWS_TO"
          };
        }
        return null;
      }).filter(Boolean);

      // 组装 subgraph 关系 (父包含子等同于一种结构)
      nodes.forEach(node => {
        if (node.parentNode) {
          const parent = nodes.find(n => n.id === node.parentNode);
          if (parent) {
            relationsPayload.push({
              source: parent.data.label,
              target: node.data.label,
              type: "CONTAINS"
            });
          }
        }
      });

      console.log('[DEBUG] about to fetch, API_BASE:', API_BASE);
      const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId.trim() || undefined,
          prompt: description,
          anchors: anchorsPayload,
          relations: relationsPayload
        })
      });

      if (!response.body) throw new Error('ReadableStream not yet supported in this browser.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let newPlans = [];
      let isFirstPlanLoaded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.type === 'progress') {
              setProgress(data.percent || 0);
              setProgressText(data.message || '生成中...');
            } else if (data.type === 'plan') {
              // Add plan to state
              const initialHistory = [
                { role: 'system', content: `初始方案已生成: ${data.plan_data.perspective}`, timestamp: Date.now() }
              ];
              const planWithHistory = { ...data.plan_data, history: initialHistory };

              newPlans = [...newPlans, planWithHistory];
              setPlans(newPlans);

              if (!isFirstPlanLoaded) {
                isFirstPlanLoaded = true;
                setActivePlanIndex(0);
                if (data.plan_data.node_details) {
                  setNodeDetails(data.plan_data.node_details);
                }
                setViewMode('result');
              }
            } else if (data.type === 'error') {
              console.error('Server error:', data.message);
            }
          } catch (e) {
            console.error('Error parsing streaming chunk:', e, line);
          }
        }
      }

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setProgressText('');
    }
  };

  const handleEdit = async () => {
    if (!modificationInput.trim()) return;
    if (plans.length === 0 || !plans[activePlanIndex]) return;

    // Store user message immediately
    const userMsg = { role: 'user', content: modificationInput, timestamp: Date.now() };

    // Store user message immediately and update the CURRENT branch/tab
    setPlans(prevPlans => {
      const updated = [...prevPlans];
      const current = updated[activePlanIndex];
      updated[activePlanIndex] = {
        ...current,
        history: [...(current.history || []), userMsg],
        perspective: current.perspective.includes('(修改中...)') ? current.perspective : `${current.perspective} (修改中...)`
      };
      return updated;
    });

    setLoading(true);
    setProgress(0);
    setProgressText('正在根据您的需求修改方案...');

    try {
      const currentPlan = plans[activePlanIndex];
      // Construct payload
      const latestNodeDetails = nodeDetails && Object.keys(nodeDetails).length > 0 ? nodeDetails : currentPlan.node_details;

      const payload = {
        session_id: sessionId.trim() || undefined,
        plan_id: currentPlan.plan_id, // Pass plan_id
        current_plan: {
          module_details: latestNodeDetails,
          overall_description: currentPlan.description,
        },
        instruction: modificationInput,
        original_query: description
      };

      // Clear input immediately
      setModificationInput('');

      const response = await fetch(`${API_BASE}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.body) throw new Error('ReadableStream not yet supported.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'progress') {
              setProgress(data.percent || 0);
              setProgressText(data.message || '修改中...');
            } else if (data.type === 'assistant') {
              const modeLabel = data.mode === 'plan_explain' ? '方案解读' : (data.mode === 'evidence_answer' ? '证据答疑' : '答疑');
              const baseText = data.message || '';
              const citations = Array.isArray(data.citations) ? data.citations : [];
              const citationText = citations.length
                ? `\n\n引用:\n${citations.map((c, i) => {
                    const title = c.title || c.name || c.source || `Reference ${i + 1}`;
                    const snippet = c.snippet ? ` - ${c.snippet}` : '';
                    return `[${i + 1}] ${title}${snippet}`;
                  }).join('\n')}`
                : '';
              const finalText = `${modeLabel}${baseText ? `: ${baseText}` : ''}${citationText}`;
              setPlans(prevPlans => {
                const updated = [...prevPlans];
                const targetIndex = activePlanIndex;
                const current = updated[targetIndex];
                const updatedPerspective = current.perspective.replace(' (修改中...)', '');
                updated[targetIndex] = {
                  ...current,
                  history: [...(current.history || []), { role: 'assistant', content: finalText, timestamp: Date.now() }],
                  perspective: updatedPerspective
                };
                return updated;
              });
            } else if (data.type === 'plan') {
              // Update the current plan with the new one
              const newPlanData = data.plan_data;

              setPlans(prevPlans => {
                const updatedPlans = [...prevPlans];
                const targetIndex = activePlanIndex; // Update the active branch
                const currentHistory = updatedPlans[targetIndex].history || [];

                // Add system success message
                const sysMsg = { role: 'system', content: `修改完成: ${data.plan_data.description ? data.plan_data.description : '架构已更新'}`, timestamp: Date.now() };

                // Remove "(修改中...)" from perspective
                const updatedPerspective = updatedPlans[targetIndex].perspective.replace(' (修改中...)', '');

                updatedPlans[targetIndex] = {
                  ...newPlanData,
                  history: [...currentHistory, sysMsg],
                  perspective: updatedPerspective // Cleaned
                };
                return updatedPlans;
              });

              // Update current view immediately
              if (newPlanData.node_details) {
                setNodeDetails(newPlanData.node_details);
              } else if (newPlanData.module_details) {
                setNodeDetails(newPlanData.module_details);
              }

            } else if (data.type === 'error') {
              console.error('Edit error:', data.message);
              // Add error message to history
              setPlans(prevPlans => {
                const updated = [...prevPlans];
                const targetIndex = activePlanIndex; // Update active branch
                const current = updated[targetIndex];
                const updatedPerspective = current.perspective.replace(' (修改中...)', '');

                updated[targetIndex] = {
                  ...current,
                  history: [...(current.history || []), { role: 'system', content: `Error: ${data.message}`, isError: true, timestamp: Date.now() }],
                  perspective: updatedPerspective
                };
                return updated;
              });
              alert(`修改失败: ${data.message}`);
            }
          } catch (e) {
            console.error('Error parsing chunk', e);
          }
        }
      }

    } catch (error) {
      console.error(error);
      alert(`请求失败: ${error.message}`);
      // Add error message to history
      setPlans(prevPlans => {
        const updated = [...prevPlans];
        const targetIndex = activePlanIndex; // Update active branch
        const current = updated[targetIndex];
        const updatedPerspective = current.perspective.replace(' (修改中...)', '');

        updated[targetIndex] = {
          ...current,
          history: [...(current.history || []), { role: 'system', content: `Request Error: ${error.message}`, isError: true, timestamp: Date.now() }],
          perspective: updatedPerspective
        };
        return updated;
      });
    } finally {
      setLoading(false);
      setProgressText('');
    }
  };

  const handleMermaidNodeClick = useCallback((nodeName) => {
    // 阻止冒泡需要在这个回调被调用的地方处理，这里只负责逻辑
    if (!nodeName) return;
    const currentDetails = detailsRef.current || {};

    let foundModule = null;
    if (Array.isArray(currentDetails)) {
      foundModule = currentDetails.find(mod => mod.name === nodeName || mod.id === nodeName);
    } else {
      foundModule = currentDetails[nodeName];
    }

    if (foundModule) {
      setSelectedNodeInfo(foundModule);
      return;
    }

    // Try finding the node as a sub_node in any module
    const entries = Array.isArray(currentDetails) ? currentDetails.map(m => [m.name, m]) : Object.entries(currentDetails);
    for (const [moduleName, moduleInfo] of entries) {
      if (moduleInfo.sub_nodes && Array.isArray(moduleInfo.sub_nodes)) {
        const subNode = moduleInfo.sub_nodes.find(sn => sn.name === nodeName || sn.id === nodeName);
        if (subNode) {
          setSelectedNodeInfo({
            ...subNode,
            isSubNode: true,
            parentModule: moduleName || 'Unknown',
            reference: moduleInfo.reference, // Inherit from parent module
            references: moduleInfo.references,
          });
          return;
        }
      }
    }

    setSelectedNodeInfo({ name: nodeName, description: '暂无详细描述' });
  }, []);

  // 开始编辑节点名称
  const startEditing = (node) => {
    setEditingNodeId(node.id);
    setEditingNodeLabel(node.data.label);
  };

  // 完成编辑节点名称
  const finishEditing = () => {
    if (editingNodeId) {
      if (editingNodeLabel.trim()) {
        setNodes((nds) => nds.map((node) => {
          if (node.id === editingNodeId) {
            return { ...node, data: { ...node.data, label: editingNodeLabel.trim() } };
          }
          return node;
        }));
      }
      setEditingNodeId(null);
      setEditingNodeLabel('');
    }
  };

  const closeNodeDetails = useCallback(() => {
    setSelectedNodeInfo(null);
    setIsNodeDetailEditing(false);
  }, []);

  useEffect(() => {
    if (!selectedNodeInfo) {
      setNodeDetailDraft({ function: '', technical_methods: '' });
      setIsNodeDetailEditing(false);
      return;
    }
    setNodeDetailDraft({
      function: selectedNodeInfo.function || '',
      technical_methods: selectedNodeInfo.technical_methods || ''
    });
  }, [selectedNodeInfo]);

  const handleNodeDetailsChange = useCallback((newDetails) => {
    let sig = '';
    try {
      sig = JSON.stringify(newDetails);
    } catch (e) { void e; }
    if (sig && sig === nodeDetailsSigRef.current) return;
    nodeDetailsSigRef.current = sig;
    setNodeDetails(newDetails);
    setPlans(prevPlans => {
      const updated = [...prevPlans];
      if (updated[activePlanIndex]) {
        updated[activePlanIndex] = {
          ...updated[activePlanIndex],
          node_details: newDetails
        };
      }
      return updated;
    });
  }, [activePlanIndex]);

  const updateSelectedNodeDetails = useCallback((detailsSource, selectedInfo, draft) => {
    if (!detailsSource || !selectedInfo) return detailsSource;
    let cloned;
    try {
      cloned = JSON.parse(JSON.stringify(detailsSource));
    } catch (e) {
      void e;
      return detailsSource;
    }

    const normalize = (value) => String(value || '').trim();
    const draftFunction = normalize(draft.function);
    const draftTechnicalMethods = normalize(draft.technical_methods);
    const selectedName = normalize(selectedInfo.name);
    const selectedId = normalize(selectedInfo.id);
    const parentName = normalize(selectedInfo.parentModule);

    const applyDraft = (target) => {
      if (!target) return false;
      target.function = draftFunction;
      target.technical_methods = draftTechnicalMethods;
      return true;
    };

    if (Array.isArray(cloned)) {
      if (selectedInfo.isSubNode) {
        const parent = cloned.find((module) =>
          normalize(module?.name) === parentName || normalize(module?.id) === parentName
        );
        if (!parent || !Array.isArray(parent.sub_nodes)) return detailsSource;
        const subNode = parent.sub_nodes.find((sn) =>
          normalize(sn?.name) === selectedName || normalize(sn?.id) === selectedId
        );
        if (!applyDraft(subNode)) return detailsSource;
        return cloned;
      }
      const module = cloned.find((item) =>
        normalize(item?.name) === selectedName ||
        normalize(item?.id) === selectedId
      );
      if (!applyDraft(module)) return detailsSource;
      return cloned;
    }

    const moduleEntries = Object.entries(cloned);

    if (selectedInfo.isSubNode) {
      const parentEntry = moduleEntries.find(([key, module]) =>
        normalize(key) === parentName ||
        normalize(module?.name) === parentName ||
        normalize(module?.id) === parentName
      );
      if (!parentEntry) return detailsSource;
      const parent = parentEntry[1];
      if (!Array.isArray(parent.sub_nodes)) return detailsSource;
      const subNode = parent.sub_nodes.find((sn) =>
        normalize(sn?.name) === selectedName || normalize(sn?.id) === selectedId
      );
      if (!applyDraft(subNode)) return detailsSource;
      return cloned;
    }

    const moduleEntry = moduleEntries.find(([key, module]) =>
      normalize(key) === selectedName ||
      normalize(module?.name) === selectedName ||
      normalize(module?.id) === selectedId
    );
    if (!moduleEntry) return detailsSource;
    const module = moduleEntry[1];
    if (!applyDraft(module)) return detailsSource;
    return cloned;
  }, []);

  const handleExport = async () => {
    if (!resultFlowRef.current) return;
    if (plans.length === 0 || !plans[activePlanIndex]) return;

    setLoading(true);
    setProgress(0);
    setProgressText('Generating Document...');
    try {
      // 1. Capture React Flow component to PNG
      const dataUrl = await resultFlowRef.current.exportImage();

      const currentPlan = plans[activePlanIndex];

      // 2. Fetch the /export endpoint
      const response = await fetch(`${API_BASE}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          plan: nodeDetails,
          overall_description: currentPlan.description || ''
        })
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // 3. Download the resulting document
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `architecture_plan_${new Date().getTime()}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      console.error("Export Error: ", err);
      alert(`Failed to export document: ${err.message}`);
    } finally {
      setLoading(false);
      setProgressText('');
    }
  };

  const saveSnapshotToSessionTree = useCallback(async (detailsOverride, messageContent, successToast) => {
    if (plans.length === 0 || !plans[activePlanIndex]) return false;
    try {
      const currentPlan = plans[activePlanIndex];
      const latestNodeDetails = detailsOverride ?? (nodeDetails && Object.keys(nodeDetails).length > 0 ? nodeDetails : currentPlan.node_details);
      const payload = {
        session_id: sessionId.trim() || undefined,
        plan_id: currentPlan.plan_id,
        current_plan: {
          module_details: latestNodeDetails,
          overall_description: currentPlan.description
        },
        original_query: description
      };
      const res = await fetch(`${API_BASE}/sessions/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '保存失败');
      setPlans(prev => {
        const u = [...prev];
        const idx = activePlanIndex;
        if (u[idx]) {
          const msg = { role: 'system', content: messageContent || '已保存当前架构', timestamp: Date.now() };
          u[idx] = { ...u[idx], plan_id: data.new_plan_id || u[idx].plan_id, history: [...(u[idx].history || []), msg] };
        }
        return u;
      });
      if (successToast) {
        alert(successToast);
      }
      return true;
    } catch (e) {
      alert(`保存失败: ${e.message}`);
      return false;
    }
  }, [plans, activePlanIndex, nodeDetails, sessionId, description]);

  const handleSaveNodeDetailDraft = useCallback(async () => {
    if (!selectedNodeInfo) return;
    const updatedDetails = updateSelectedNodeDetails(resolvedNodeDetails, selectedNodeInfo, nodeDetailDraft);
    handleNodeDetailsChange(updatedDetails);
    setSelectedNodeInfo(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        function: (nodeDetailDraft.function || '').trim(),
        technical_methods: (nodeDetailDraft.technical_methods || '').trim()
      };
    });
    await saveSnapshotToSessionTree(
      updatedDetails,
      `已保存节点「${selectedNodeInfo.name}」详情`,
      `已保存节点「${selectedNodeInfo.name}」并写入方案快照`
    );
    setIsNodeDetailEditing(false);
  }, [selectedNodeInfo, nodeDetailDraft, resolvedNodeDetails, updateSelectedNodeDetails, handleNodeDetailsChange, saveSnapshotToSessionTree]);

  const handleSaveSnapshot = async () => {
    await saveSnapshotToSessionTree(undefined, '已保存当前架构', '已保存当前架构');
  };

  const handleRevertLast = async () => {
    try {
      if (plans.length === 0 || !plans[activePlanIndex]) throw new Error('无可用方案');
      const currentPlan = plans[activePlanIndex];
      const params = new URLSearchParams();
      params.set('session_id', sessionId.trim() || 'anonymous_session');
      if (currentPlan.plan_id) params.set('plan_id', currentPlan.plan_id);
      const res = await fetch(`${API_BASE}/sessions/revert?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '无法回退');
      const p = data.plan;
      const cp = p?.arch_json || {};
      const details = cp.module_details || cp;
      if (!details) throw new Error('快照缺少模块数据');
      setNodeDetails(details);
      setPlans(prev => {
        const u = [...prev];
        const idx = activePlanIndex;
        if (u[idx]) {
          u[idx] = {
            ...u[idx],
            plan_id: p.plan_id || u[idx].plan_id,
            node_details: details,
            description: p.description || cp.overall_description || u[idx].description,
            perspective: p.perspective || u[idx].perspective,
            history: [...(u[idx].history || []), { role: 'system', content: '已回退到上一版本', timestamp: Date.now() }]
          };
        }
        return u;
      });
      alert('已回退到上一版本');
    } catch (e) {
      alert(`恢复失败: ${e.message}`);
    }
  };

  const activePlan = plans[activePlanIndex] || null;

  // Capture thumbnail for a plan after its diagram renders
  const captureThumbnail = useCallback(async (index) => {
    if (!resultFlowRef.current) return;
    try {
      const dataUrl = await resultFlowRef.current.exportImage();
      setPlanThumbnails(prev => ({ ...prev, [index]: dataUrl }));
    } catch (e) { void e; }
  }, []);

  // Capture thumbnail when active plan changes (after a short delay for render)
  useEffect(() => {
    if (plans.length === 0) return;
    const timer = setTimeout(() => captureThumbnail(activePlanIndex), 800);
    return () => clearTimeout(timer);
  }, [activePlanIndex, plans.length, captureThumbnail]);
  const otherPlans = plans
    .map((plan, index) => ({ plan, index }))
    .filter((item) => item.index !== activePlanIndex);

  return (
    <div className="app-container">
      <div style={{ position: 'fixed', top: 8, right: 16, zIndex: 9999 }}>
        <a
          href="#/chat"
          style={{
            fontSize: '0.82rem', fontWeight: 500, color: '#217cf3',
            background: '#e8f0fe', padding: '4px 12px', borderRadius: 6,
            textDecoration: 'none', border: '1px solid #c5d8fb',
          }}
        >
          💬 LLM Chat
        </a>
      </div>

      <main className="main-content">
        <div className="generator-layout" style={viewMode === 'result' ? { gridTemplateColumns: '320px 1fr' } : {}}>

          {/* --- 左侧边栏 (输入 + 工具 + 代码) --- */}
          <div className="sidebar-left">

            {/* 1. 需求 / 对话 面板 */}
            <div className="left-card" style={viewMode === 'result' ? { flex: '1 1 auto', display: 'flex', flexDirection: 'column' } : { flex: '0 0 auto' }}>
              <div style={{ marginBottom: '10px' }}>
                <input
                  className="styled-input"
                  placeholder="被试 ID"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  disabled={loading || plans.length > 0}
                  style={{ marginBottom: '5px', height: '32px' }}
                />
              </div>
              <div className="card-title">{viewMode === 'result' ? '对话交互 (优化方案)' : '需求描述'}</div>

              {viewMode === 'result' && (
                <div style={{ flex: 1, backgroundColor: '#f5f7fa', borderRadius: '4px', padding: '10px', marginBottom: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #eee' }}>
                  {/* Render History */}
                  {plans.length > 0 && plans[activePlanIndex] && plans[activePlanIndex].history && plans[activePlanIndex].history.map((msg, idx) => (
                    <div key={idx} style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      backgroundColor: msg.role === 'user' ? '#e3f2fd' : (msg.isError ? '#ffebee' : '#fff'),
                      border: msg.role === 'user' ? 'none' : '1px solid #ddd',
                      padding: '8px 12px',
                      borderRadius: msg.role === 'user' ? '8px 8px 0 8px' : '8px 8px 8px 0',
                      maxWidth: '85%',
                      fontSize: '0.9rem',
                      color: msg.isError ? '#c62828' : '#333',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                      {msg.role === 'system' && <strong style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '2px' }}>System</strong>}
                      {msg.role === 'assistant' && <strong style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '2px' }}>Assistant</strong>}
                      {msg.content}
                    </div>
                  ))}

                  {/* Fallback for empty history or loading state */}
                  {(!plans[activePlanIndex] || !plans[activePlanIndex].history || plans[activePlanIndex].history.length === 0) && (
                    <div style={{ alignSelf: 'center', color: '#999', fontSize: '0.85rem', marginTop: '20px' }}>
                      暂无修改记录
                    </div>
                  )}
                </div>
              )}

              <textarea
                className="styled-input"
                rows={viewMode === 'result' ? 3 : 4}
                placeholder={viewMode === 'result' ? "输入方案优化需求..." : "例如：设计一个包含RAG和LLM的历史教育系统..."}
                value={viewMode === 'result' ? modificationInput : description}
                onChange={(e) => {
                  if (viewMode === 'edit') setDescription(e.target.value);
                  else setModificationInput(e.target.value);
                }}
                disabled={loading}
                style={viewMode === 'result' ? { flexShrink: 0, resize: 'none' } : {}}
              />

              {viewMode === 'result' && (
                <button
                  className="btn-primary"
                  style={{ marginTop: '10px', flexShrink: 0 }}
                  disabled={loading || !modificationInput.trim()}
                  onClick={handleEdit}
                >
                  {loading ? '修改中...' : '发送修改指令'}
                </button>
              )}
            </div>

            {/* 2. 功能面板 (手动节点) */}
            <div className="left-card" style={{ flex: '0 0 auto', display: viewMode === 'result' ? 'none' : 'flex' }}>
              <div className="card-title">功能面板 (预设节点)</div>
              <div className="action-bar" style={{ marginTop: 0, display: 'flex', alignItems: 'center' }}>
                <input
                  className="styled-input"
                  style={{
                    marginBottom: 0,
                    flex: 2,
                    minWidth: 0,
                    height: '36px',
                    paddingLeft: '10px'
                  }}
                  placeholder="节点名称"
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && openAddNodeModal()}
                />
                <button
                  className="btn-add"
                  onClick={openAddNodeModal}
                  style={{
                    marginLeft: '5px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    height: '36px',
                    padding: '0 10px',
                    backgroundColor: '#217cf3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    width: 'auto'
                  }}
                >
                  添加
                </button>
                <button
                  className="btn-clear"
                  onClick={clearNodes}
                  style={{
                    marginLeft: '5px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    height: '36px',
                    padding: '0 10px',
                    backgroundColor: '#ff4d4f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    width: 'auto'
                  }}
                  title="清空所有节点"
                >
                  清空
                </button>
              </div>


              {/* 显示已添加的标签 */}
              <div className="manual-nodes-container" onClick={(e) => e.stopPropagation()}>
                {nodes.length === 0 && <span style={{ color: '#ccc', fontSize: '12px' }}>暂无节点</span>}
                {nodes.map(node => (
                  <span key={node.id} className="tag-node" onDoubleClick={() => startEditing(node)}>
                    {editingNodeId === node.id ? (
                      <input
                        autoFocus
                        value={editingNodeLabel}
                        onChange={(e) => setEditingNodeLabel(e.target.value)}
                        onBlur={finishEditing}
                        onKeyDown={(e) => e.key === 'Enter' && finishEditing()}
                        style={{
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: '#333',
                          width: '60px',
                          fontSize: '12px'
                        }}
                      />
                    ) : (
                      node.data.label
                    )}
                    <span className="tag-remove" onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}>×</span>
                  </span>
                ))}
              </div>

              <button
                className="btn-primary"
                style={{ marginTop: '15px', position: 'relative', overflow: 'hidden' }}
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${progress}%`,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    transition: 'width 0.5s ease'
                  }} />
                )}
                {loading ? `${progressText} ${progress}%` : '开始生成流程图'}
              </button>
            </div>

            <div className="left-card" style={{ flex: '0 0 auto', display: viewMode === 'result' ? 'none' : 'flex', minHeight: 0 }}>
              <div className="card-title" style={{ fontSize: '0.9rem', color: '#666' }}>快速测试渲染 JSON (跳过后端)</div>
              <textarea
                className="styled-input"
                rows={4}
                value={testJsonStr}
                onChange={(e) => setTestJsonStr(e.target.value)}
                placeholder='在此粘贴包含 module_details 的 arch_plan 直接渲染'
                spellCheck="false"
              />
              <button
                className="btn-primary"
                style={{ marginTop: '10px', backgroundColor: '#f39c12', border: 'none' }}
                onClick={handleTestJson}
              >
                直接渲染测试
              </button>
            </div>
          </div>

          {/* --- 中间画布 (节点) --- */}
          {viewMode !== 'result' && (
            <div className="panel canvas-panel" ref={reactFlowWrapper} style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
              <div className="card-title" style={{ padding: '10px', borderBottom: '1px solid #eee', position: 'absolute', top: 0, left: 0, zIndex: 10, background: 'rgba(255,255,255,0.8)', width: '100%' }}>
                节点编辑区
              </div>

              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={closeNodeDetails}
                onNodeDragStop={onNodeDragStop}
                onEdgeDoubleClick={onEdgeDoubleClick}
                fitView
                attributionPosition="bottom-right"
                deleteKeyCode={['Backspace', 'Delete']}
                nodesDraggable={!loading}
                nodesConnectable={!loading}
                elementsSelectable={!loading}
              >
                <Background color="#aaa" gap={16} />
                <Controls />
                {loading && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(255,255,255,0.5)', zIndex: 100,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                  }}>
                    <div style={{ color: '#333', fontWeight: 'bold' }}>锁定中...</div>
                  </div>
                )}
              </ReactFlow>

              {nodes.length === 0 && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  color: '#999', textAlign: 'center', zIndex: 5, pointerEvents: 'none'
                }}>
                  <p>在左侧添加节点，<br />然后在画布中拖拽、连线。</p>
                </div>
              )}
            </div>
          )}

          {/* --- 右侧边栏 (多方案展示区) --- */}
            <div className="panel sidebar-right" style={{ display: 'flex', flexDirection: 'column', flex: viewMode === 'result' ? 1 : '0 0 60%', position: 'relative', minHeight: 0 }}>
            {/* 工作表 Tabs */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              borderBottom: '1px solid #ccc',
              backgroundColor: '#f5f5f5',
              gap: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 320px', minWidth: 0, overflowX: 'auto' }}>
                  {activePlan ? (
                  <div
                    onClick={() => setIsMorePerspectivesOpen(false)}
                    style={{
                      padding: '10px 20px',
                      cursor: 'pointer',
                      backgroundColor: '#fff',
                      borderBottom: '2px solid #217cf3',
                      fontWeight: 'bold',
                      color: '#217cf3',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {activePlan.perspective || `方案 ${activePlanIndex + 1}`}
                  </div>
                ) : (
                  <div style={{ padding: '10px 20px', color: '#999' }}>暂无方案</div>
                )}
                {otherPlans.length > 0 && (
                  <div
                    onClick={() => setIsMorePerspectivesOpen((prev) => !prev)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      marginLeft: '8px',
                      borderRadius: '6px',
                      border: '1px solid #d5dbe7',
                      backgroundColor: isMorePerspectivesOpen ? '#eaf2ff' : '#fff',
                      color: '#3e4a5a',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      fontSize: '13px',
                    }}
                  >
                    {`查看更多视角（+${otherPlans.length}）`}
                  </div>
                )}
                </div>

                {plans.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', padding: '8px 12px', maxWidth: '100%' }}>
                    <button
                      onClick={handleSaveSnapshot}
                      disabled={loading}
                      style={{
                        padding: '6px 15px',
                        backgroundColor: '#ffffffff',
                        color: '#2d76e2ff',
                        border: '1px solid #2d76e2ff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleRevertLast}
                      disabled={loading}
                      style={{
                        padding: '6px 15px',
                        backgroundColor: '#ffffffff',
                        color: '#2d76e2ff',
                        border: '1px solid #2d76e2ff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      Revert
                    </button>
                    <button
                      onClick={handleExport}
                      disabled={loading}
                      style={{
                        padding: '6px 15px',
                        backgroundColor: '#28a745',
                        color: '#fff',
                        border: '1px solid #28a745',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      Export (.docx)
                    </button>
                    <button
                      onClick={() => setViewMode(viewMode === 'result' ? 'edit' : 'result')}
                      style={{
                        padding: '6px 15px',
                        backgroundColor: viewMode === 'result' ? '#fff' : '#217cf3',
                        color: viewMode === 'result' ? '#217cf3' : '#fff',
                        border: '1px solid #217cf3',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      {viewMode === 'result' ? '← 返回工作区' : '全屏查看方案'}
                    </button>
                  </div>
                )}
              </div>
              {isMorePerspectivesOpen && otherPlans.length > 0 && (
                <div style={{
                  margin: '0 12px 10px',
                  padding: '8px',
                  border: '1px solid #e3e8f0',
                  borderRadius: '8px',
                  backgroundColor: '#fff'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                    {otherPlans.map(({ plan, index }) => {
                      const mods = getProcessingModules(plan.node_details ?? plan.module_details);
                      const thumb = planThumbnails[index];
                      return (
                        <div
                          key={index}
                          onClick={() => { setActivePlanIndex(index); setIsMorePerspectivesOpen(false); }}
                          style={{
                            border: '1px solid #e8edf5',
                            borderRadius: '8px',
                            padding: '10px',
                            cursor: 'pointer',
                            backgroundColor: '#f9fbff',
                            transition: 'box-shadow 0.15s, border-color 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(33,124,243,0.15)'; e.currentTarget.style.borderColor = '#a8c8f8'; }}
                          onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = '#e8edf5'; }}
                        >
                          <div style={{ fontWeight: 600, color: '#2a3550', marginBottom: '3px', fontSize: '13px' }}>
                            {plan.perspective || `方案 ${index + 1}`}
                          </div>
                          <div style={{ color: '#596579', fontSize: '11px', lineHeight: 1.4, marginBottom: mods.length ? 5 : 0 }}>
                            {firstSentence(plan.overall_description || plan.description)}
                          </div>
                          {mods.length > 0 && (
                            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>
                              {mods.map(m => (
                                <span key={m} style={{ fontSize: '10px', background: '#fff4df', color: '#9a6700', border: '1px solid #f59e0b', borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap' }}>{m}</span>
                              ))}
                            </div>
                          )}
                          {thumb ? (
                            <img src={thumb} alt="方案预览" style={{ width: '100%', height: 'auto', borderRadius: 5, border: '1px solid #e0e7f0', display: 'block' }} />
                          ) : (
                            <div style={{ width: '100%', height: 80, background: '#f0f4fa', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 11 }}>
                              预览加载中…
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* 渲染图部分 */}
              <div className="mermaid-wrapper" style={{ flex: 3, overflow: 'hidden', borderRight: '1px solid #eee', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
                  <X6FlowViewer
                    ref={resultFlowRef}
                    nodeDetails={resolvedNodeDetails}
                    onNodeClick={handleMermaidNodeClick}
                    onPaneClick={closeNodeDetails}
                    onNodeDetailsChange={handleNodeDetailsChange}
                  />
                </div>
                {(Array.isArray(resolvedNodeDetails) ? resolvedNodeDetails.length === 0 : Object.keys(resolvedNodeDetails || {}).length === 0) && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ color: '#999', textAlign: 'center', marginTop: '50px' }}>
                      <h3>图表空闲</h3>
                      <p>请在左侧输入需求并生成。</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 节点详情部分 */}
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', backgroundColor: '#fafafa' }}>
                <div className="card-title" style={{ fontSize: '1rem', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
                  总体描述
                </div>
                {plans.length > 0 && plans[activePlanIndex] && plans[activePlanIndex].description && (
                  <div style={{ fontSize: '0.9rem', color: '#555', marginBottom: '20px', whiteSpace: 'pre-wrap' }}>
                    {plans[activePlanIndex].description}
                  </div>
                )}

                <div className="card-title" style={{ fontSize: '1rem', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
                  节点详情
                </div>
                <div style={{ fontSize: '0.9rem', color: '#444' }}>
                  {selectedNodeInfo ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                        <strong style={{ color: '#333' }}>名称:</strong>
                        <div style={{ marginTop: '5px' }}>
                          {selectedNodeInfo.name}
                          {selectedNodeInfo.isSubNode && (
                            <span style={{ fontSize: '0.85rem', color: '#666', marginLeft: '8px' }}>(所属模块: {selectedNodeInfo.parentModule})</span>
                          )}
                        </div>
                      </div>
                      <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                        <strong style={{ color: '#333' }}>功能:</strong>
                        {isNodeDetailEditing ? (
                          <textarea
                            className="styled-input"
                            rows={6}
                            value={nodeDetailDraft.function}
                            onChange={(e) => setNodeDetailDraft((prev) => ({ ...prev, function: e.target.value }))}
                            style={{ marginTop: '8px', marginBottom: 0, resize: 'vertical', fontSize: '0.88rem', lineHeight: 1.5, minHeight: '110px' }}
                          />
                        ) : (
                          <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, color: '#333', maxHeight: 'none' }}>
                            {nodeDetailDraft.function || '暂无'}
                          </div>
                        )}
                      </div>
                      <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                        <strong style={{ color: '#333' }}>技术方法:</strong>
                        {isNodeDetailEditing ? (
                          <textarea
                            className="styled-input"
                            rows={6}
                            value={nodeDetailDraft.technical_methods}
                            onChange={(e) => setNodeDetailDraft((prev) => ({ ...prev, technical_methods: e.target.value }))}
                            style={{ marginTop: '8px', marginBottom: 0, resize: 'vertical', fontSize: '0.88rem', lineHeight: 1.5, minHeight: '110px' }}
                          />
                        ) : (
                          <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, color: '#333', maxHeight: 'none' }}>
                            {nodeDetailDraft.technical_methods || '暂无'}
                          </div>
                        )}
                      </div>
                      {!isNodeDetailEditing ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setIsNodeDetailEditing(true)}
                            disabled={loading}
                            style={{ padding: '4px 10px', background: '#fff', border: '1px solid #d0d7de', color: '#555', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' }}
                          >
                            编辑详情
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setNodeDetailDraft({
                                function: selectedNodeInfo.function || '',
                                technical_methods: selectedNodeInfo.technical_methods || ''
                              });
                              setIsNodeDetailEditing(false);
                            }}
                            disabled={loading}
                            style={{ padding: '4px 10px', background: '#fff', border: '1px solid #d0d7de', color: '#666', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' }}
                          >
                            取消
                          </button>
                          <button
                            onClick={handleSaveNodeDetailDraft}
                            disabled={loading}
                            style={{ padding: '4px 10px', background: '#217cf3', border: '1px solid #217cf3', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' }}
                          >
                            保存
                          </button>
                        </div>
                      )}
                      {selectedNodeInfo.ports && (
                        <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                          <p><strong style={{ color: '#333' }}>输入:</strong></p>
                          <ul style={{ paddingLeft: '20px', margin: '5px 0', color: '#666' }}>
                            {selectedNodeInfo.ports.incoming?.map((p, i) => (
                              <li key={i}>{p.edge_label} (from {p.source_mod || 'Unknown'})</li>
                            ))}
                            {(!selectedNodeInfo.ports.incoming || selectedNodeInfo.ports.incoming.length === 0) && <li>无</li>}
                          </ul>
                          <p style={{ marginTop: '10px' }}><strong style={{ color: '#333' }}>输出:</strong></p>
                          <ul style={{ paddingLeft: '20px', margin: '5px 0', color: '#666' }}>
                            {selectedNodeInfo.ports.outgoing?.map((p, i) => (
                              <li key={i}>{p.edge_label} (to {p.target_mod || 'Unknown'})</li>
                            ))}
                            {(!selectedNodeInfo.ports.outgoing || selectedNodeInfo.ports.outgoing.length === 0) && <li>无</li>}
                          </ul>
                        </div>
                      )}
                      {/* 展示参考来源 */}
                      {(() => {
                        // 1. Backend injected directly:
                        if (selectedNodeInfo.reference) {
                          return (
                            <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                              <strong style={{ color: '#333' }}>来源:</strong>
                              <div style={{ marginTop: '5px' }}>
                                <div><strong>{selectedNodeInfo.reference.name}</strong></div>
                                {selectedNodeInfo.reference.source && (
                                  <div style={{ fontSize: '0.85rem', color: '#217cf3', marginTop: '5px' }}><strong>Source File: </strong>{selectedNodeInfo.reference.source}</div>
                                )}
                                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '5px', whiteSpace: 'pre-wrap' }}>{selectedNodeInfo.reference.technical_details}</div>
                              </div>
                            </div>
                          );
                        }

                        // 2. Fallback to plan_data.used_references
                        if (plans.length > 0 && plans[activePlanIndex] && plans[activePlanIndex].used_references) {
                          const modName = selectedNodeInfo.isSubNode ? selectedNodeInfo.parentModule : selectedNodeInfo.name;
                          const usedRefs = plans[activePlanIndex].used_references[modName];
                          if (usedRefs && usedRefs.length > 0) {
                            return (
                              <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                                <strong style={{ color: '#333' }}>来源:</strong>
                                <div style={{ marginTop: '5px' }}>
                                  {usedRefs.map((r, idx) => (
                                    <div key={idx} style={{ marginBottom: '10px' }}>
                                      <div><strong>{r.name}</strong></div>
                                      {r.source && (
                                        <div style={{ fontSize: '0.85rem', color: '#217cf3', marginTop: '5px' }}><strong>Souce File: </strong>{r.source}</div>
                                      )}
                                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '5px', whiteSpace: 'pre-wrap' }}>{r.text}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                        }

                        // 3. Fallback to raw value from json
                        const rawRefs = selectedNodeInfo.references;
                        if (rawRefs && String(rawRefs).toLowerCase() !== 'none' && String(rawRefs).toLowerCase() !== 'null') {
                          const normalizedRawText = typeof rawRefs === 'string'
                            ? rawRefs
                            : JSON.stringify(rawRefs, null, 2);
                          return (
                            <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                              <strong style={{ color: '#333' }}>来源:</strong>
                              <div style={{ marginTop: '5px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{normalizedRawText}</div>
                            </div>
                          );
                        }

                        // 4. No references found
                        return (
                          <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                            <strong style={{ color: '#333' }}>来源:</strong>
                            <div style={{ marginTop: '5px' }}>无相关源论文</div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                      点击左侧图表节点查看详情
                    </div>
                  )}
                </div>
              </div>
            </div>


          </div>

        </div>
      </main>

      {/* Node Details Modal */}
      {isNodeModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', width: '400px', maxWidth: '90%' }}>
            <h3 style={{ marginTop: 0 }}>{modalNodeData.id ? '编辑节点' : 'Add Node'}</h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Name:</label>
              <input
                className="styled-input"
                value={modalNodeData.label}
                onChange={e => setModalNodeData({ ...modalNodeData, label: e.target.value })}
                autoFocus
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Description:</label>
              <textarea
                className="styled-input"
                rows={3}
                value={modalNodeData.description}
                onChange={e => setModalNodeData({ ...modalNodeData, description: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Role (Optional):</label>
              <input
                className="styled-input"
                value={modalNodeData.role}
                onChange={e => setModalNodeData({ ...modalNodeData, role: e.target.value })}
                placeholder="例如: processing_core"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-clear" style={{ padding: '8px 15px', border: '1px solid #ccc', background: '#f5f5f5', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setIsNodeModalOpen(false)}>Cancel</button>
              <button className="btn-primary" style={{ padding: '8px 15px', background: '#217cf3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={handleSaveNodeModal}>Save</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
