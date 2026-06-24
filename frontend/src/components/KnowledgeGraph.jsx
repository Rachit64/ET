import React, { useState, useEffect, useRef } from 'react';

export default function KnowledgeGraph({ graphData }) {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightedNodes, setHighlightedNodes] = useState(new Set());
  const [highlightedLinks, setHighlightedLinks] = useState(new Set());
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const draggingNodeRef = useRef(null);

  const width = 600;
  const height = 240;

  // Initialize nodes and links with layout coordinates
  useEffect(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) return;

    // Map incoming nodes and add positions if not present
    const nodeMap = {};
    const initializedNodes = graphData.nodes.map((node, i) => {
      // Place in a circle layout initially
      const angle = (i / graphData.nodes.length) * 2 * Math.PI;
      const rx = width / 2 + Math.cos(angle) * 120;
      const ry = height / 2 + Math.sin(angle) * 70;
      
      const n = {
        ...node,
        x: rx,
        y: ry,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null
      };
      nodeMap[node.id] = n;
      return n;
    });

    const initializedLinks = graphData.links.map(link => ({
      ...link,
      sourceObj: nodeMap[typeof link.source === 'object' ? link.source.id : link.source],
      targetObj: nodeMap[typeof link.target === 'object' ? link.target.id : link.target]
    })).filter(l => l.sourceObj && l.targetObj);

    setNodes(initializedNodes);
    setLinks(initializedLinks);
    setSelectedNode(null);
    setHighlightedNodes(new Set());
    setHighlightedLinks(new Set());
  }, [graphData]);

  // Force-directed layout physics simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const tick = () => {
      const kRepulsion = 400; // Repulsive charge
      const kGravity = 0.05;  // Gravity towards center
      const kSpring = 0.06;   // Spring strength
      const springLength = 80; // Target link length
      const damping = 0.85;   // Velocity damping

      // 1. Repulsion between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy + 0.1;
          const dist = Math.sqrt(distSq);
          
          if (dist < 220) {
            // Coulomb's law style repulsion
            const force = kRepulsion / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            if (n1.fx === null) { n1.vx -= fx; n1.vy -= fy; }
            if (n2.fx === null) { n2.vx += fx; n2.vy += fy; }
          }
        }
      }

      // 2. Spring attraction along links
      links.forEach(link => {
        const s = link.sourceObj;
        const t = link.targetObj;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        
        // Spring Hooke's Law force
        const force = kSpring * (dist - springLength);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        if (s.fx === null) { s.vx += fx; s.vy += fy; }
        if (t.fx === null) { t.vx -= fx; t.vy -= fy; }
      });

      // 3. Gravity attraction to center & boundary collision
      const cx = width / 2;
      const cy = height / 2;
      nodes.forEach(n => {
        if (n.fx !== null) {
          n.x = n.fx;
          n.y = n.fy;
          n.vx = 0;
          n.vy = 0;
          return;
        }

        // Center gravity
        n.vx += (cx - n.x) * kGravity;
        n.vy += (cy - n.y) * kGravity;

        // Apply velocities and damping
        n.x += n.vx;
        n.y += n.vy;
        n.vx *= damping;
        n.vy *= damping;

        // Contain in boundaries
        const padding = 15;
        n.x = Math.max(padding, Math.min(width - padding, n.x));
        n.y = Math.max(padding, Math.min(height - padding, n.y));
      });

      // Force render update
      setNodes([...nodes]);
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationRef.current);
  }, [nodes, links]);

  // Handle Dragging
  const handleMouseDown = (e, node) => {
    const rect = canvasRef.current.getBoundingClientRect();
    node.fx = e.clientX - rect.left;
    node.fy = e.clientY - rect.top;
    draggingNodeRef.current = node;
    
    // Select & highlight node + neighbors
    setSelectedNode(node);
    
    const activeNodes = new Set([node.id]);
    const activeLinks = new Set();
    
    links.forEach(l => {
      if (l.sourceObj.id === node.id) {
        activeNodes.add(l.targetObj.id);
        activeLinks.add(`${l.sourceObj.id}-${l.targetObj.id}`);
      } else if (l.targetObj.id === node.id) {
        activeNodes.add(l.sourceObj.id);
        activeLinks.add(`${l.sourceObj.id}-${l.targetObj.id}`);
      }
    });

    setHighlightedNodes(activeNodes);
    setHighlightedLinks(activeLinks);
  };

  const handleMouseMove = (e) => {
    if (!draggingNodeRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    draggingNodeRef.current.fx = x;
    draggingNodeRef.current.fy = y;
  };

  const handleMouseUp = () => {
    if (draggingNodeRef.current) {
      draggingNodeRef.current.fx = null;
      draggingNodeRef.current.fy = null;
      draggingNodeRef.current = null;
    }
  };

  // Node Color Mapper
  const getNodeColor = (type) => {
    switch (type) {
      case 'Supplier': return '#10b981';
      case 'Corridor': return '#f97316';
      case 'Refinery': return '#06b6d4';
      case 'RiskEvent': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  return (
    <div className="kg-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* Dynamic Interactive SVG Canvas */}
      <div className="kg-canvas-wrapper" ref={canvasRef}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ background: '#07090e' }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="20" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
            </marker>
          </defs>
          
          {/* Render links */}
          {links.map((link, idx) => {
            const isHighlighted = highlightedLinks.size === 0 || highlightedLinks.has(`${link.sourceObj.id}-${link.targetObj.id}`);
            return (
              <line
                key={idx}
                x1={link.sourceObj.x}
                y1={link.sourceObj.y}
                x2={link.targetObj.x}
                y2={link.targetObj.y}
                stroke={isHighlighted ? '#64748b' : '#1e293b'}
                strokeWidth={isHighlighted ? 1.5 : 0.8}
                strokeDasharray={link.relationship === 'THREATENS' ? '3, 2' : 'none'}
                markerEnd="url(#arrow)"
                style={{ transition: 'stroke 0.2s' }}
              />
            );
          })}

          {/* Render nodes */}
          {nodes.map(node => {
            const isHighlighted = highlightedNodes.size === 0 || highlightedNodes.has(node.id);
            const isSelected = selectedNode && selectedNode.id === node.id;
            const color = getNodeColor(node.type);
            
            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                onMouseDown={(e) => handleMouseDown(e, node)}
                style={{ cursor: 'grab' }}
              >
                {/* Glowing Outer Ring for selected */}
                {isSelected && (
                  <circle r={14} fill="none" stroke={color} strokeWidth={2} opacity={0.6} />
                )}
                
                {/* Node circle */}
                <circle
                  r={8}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={isHighlighted ? 1.5 : 0.5}
                  opacity={isHighlighted ? 1.0 : 0.25}
                  style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
                />
                
                {/* Node text label */}
                <text
                  y={-14}
                  textAnchor="middle"
                  fill={isHighlighted ? '#f8fafc' : '#475569'}
                  fontSize="8.5px"
                  fontFamily="sans-serif"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  opacity={isHighlighted ? 1.0 : 0.3}
                  style={{ pointerEvents: 'none', userSelect: 'none', transition: 'fill 0.2s' }}
                >
                  {node.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Info Detail Sidebar Panel */}
      <div className="kg-details-panel">
        {selectedNode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getNodeColor(selectedNode.type) }} />
              <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{selectedNode.type.toUpperCase()}</strong>
            </div>
            <h4 style={{ fontSize: '0.95rem', color: '#22d3ee', margin: '2px 0 6px 0' }}>{selectedNode.id}</h4>
            
            {/* Metadata key values */}
            {Object.entries(selectedNode).map(([key, val]) => {
              if (['id', 'type', 'x', 'y', 'vx', 'vy', 'fx', 'fy'].includes(key)) return null;
              return (
                <div key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '3px' }}>
                  <span style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase' }}>{key.replace('_', ' ')}</span>
                  <div style={{ color: '#cbd5e1', fontSize: '0.75rem', marginTop: '1px' }}>{val}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: '#64748b', textAlign: 'center', paddingTop: '40px' }}>
            Click & drag any node on the graph to inspect relationships
          </div>
        )}
      </div>
    </div>
  );
}
