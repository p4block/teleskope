import { useCallback, useEffect } from "react";
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    Edge,
    Node,
    Controls,
    Background,
    Panel,
    BackgroundVariant,
    XYPosition,
    Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { useResources, type ApiResourceInfo } from "../hooks/useKube";
import { Loader2 } from "lucide-react";

// Types
interface DashboardProps {
    onNavigate: (resource: ApiResourceInfo, name: string, namespace?: string) => void;
}

// Node colors/styles
const nodeStyles: Record<string, React.CSSProperties> = {
    NamespaceGroup: {
        background: "rgba(245, 247, 250, 0.4)",
        border: "1px dashed #94a3b8",
        borderRadius: "12px",
        padding: "10px",
        zIndex: -1,
    },
    Ingress: {
        background: "#fdf4ff",
        color: "#86198f",
        border: "1px solid #d946ef",
        borderRadius: "8px",
        padding: "8px",
        fontSize: "12px",
        width: 160,
        textAlign: "center",
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    },
    Service: {
        background: "#ecfdf5",
        color: "#065f46",
        border: "1px solid #34d399",
        borderRadius: "8px",
        padding: "8px",
        fontSize: "12px",
        width: 160,
        textAlign: "center",
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    },
    Pod: {
        background: "#eff6ff",
        color: "#1e40af",
        border: "1px solid #60a5fa",
        borderRadius: "8px",
        padding: "8px",
        fontSize: "12px",
        width: 160,
        textAlign: "center",
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    },
};

// Custom Node for Namespace Group
const NamespaceNode = ({ data }: { data: { label: string } }) => {
    return (
        <div className="h-full w-full relative">
            <div className="absolute top-0 left-0 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50 rounded-br-lg border-b border-r border-slate-200">
                {data.label}
            </div>
        </div>
    );
};

const nodeTypes = {
    namespace: NamespaceNode,
};

// Layout helper for Namespace content
const layoutNamespaceContent = (nodes: Node<Record<string, unknown>, string>[], edges: Edge<Record<string, unknown>>[]) => {
    const dagreGraphInstance = new dagre.graphlib.Graph();
    dagreGraphInstance.setDefaultEdgeLabel(() => ({}));
    dagreGraphInstance.setGraph({ rankdir: "LR", ranksep: 60, nodesep: 30 }); // Left-to-right inside namespace

    nodes.forEach((node) => {
        dagreGraphInstance.setNode(node.id, { width: 180, height: 60 });
    });

    edges.forEach((edge) => {
        dagreGraphInstance.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraphInstance);

    // Get Bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

         const positionedNodes = nodes.map((node) => {
             const nodeWithPosition = dagreGraphInstance.node(node.id);
             const x = nodeWithPosition.x - 90;
             const y = nodeWithPosition.y - 30;

             if (x < minX) minX = x;
             if (y < minY) minY = y;
             if (x + 180 > maxX) maxX = x + 180;
             if (y + 60 > maxY) maxY = y + 60;

             return {
                 ...node,
                 targetPosition: Position.Left,
                 sourcePosition: Position.Right,
                 position: { x, y } as XYPosition,
             };
         });

    // If no nodes, return empty bounds
    if (nodes.length === 0) {
        return { nodes: [], width: 200, height: 100 };
    }

    // Shift nodes to be relative to (0,0) plus some padding
    const padding = 40;
    const headerHeight = 40;

    const finalNodes: Node<Record<string, unknown>, string>[] = positionedNodes.map(n => ({
        ...n,
        position: {
            x: n.position.x - minX + padding,
            y: n.position.y - minY + headerHeight + padding
        } as XYPosition
    }));

    return {
        nodes: finalNodes,
        width: (maxX - minX) + (padding * 2),
        height: (maxY - minY) + headerHeight + (padding * 2)
    };
};

export function Dashboard({ onNavigate }: DashboardProps) {
    // 1. Fetch Resources
    const { data: ingresses, isLoading: loadingIngress } = useResources({
        group: "networking.k8s.io",
        version: "v1",
        kind: "Ingress",
        plural: "ingresses",
        namespace: "",
    });

    const { data: services, isLoading: loadingService } = useResources({
        group: "",
        version: "v1",
        kind: "Service",
        plural: "services",
        namespace: "",
    });

    const { data: pods, isLoading: loadingPod } = useResources({
        group: "",
        version: "v1",
        kind: "Pod",
        plural: "pods",
        namespace: "",
    });

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // 3. Process Data & Build Graph
    useEffect(() => {
        if (loadingIngress || loadingService || loadingPod) return;
        if (!ingresses && !services && !pods) return;

        const allNodes: Node<Record<string, unknown>, string>[] = [];
        const allEdges: Edge<Record<string, unknown>>[] = [];

        // Group resources by namespace
        const resourcesByNs = new Map<string, { ingresses: any[], services: any[], pods: any[] }>();
        const getNsBucket = (ns: string) => {
            if (!resourcesByNs.has(ns)) resourcesByNs.set(ns, { ingresses: [], services: [], pods: [] });
            return resourcesByNs.get(ns)!;
        };

        ingresses?.forEach((r: any) => getNsBucket(r.metadata.namespace).ingresses.push(r));
        services?.forEach((r: any) => getNsBucket(r.metadata.namespace).services.push(r));
        pods?.forEach((r: any) => getNsBucket(r.metadata.namespace).pods.push(r));

        // Global layout cursor for namespaces
        let currentY = 0;
        const NS_PADDING = 50;

        // Process each Namespace
        // Sort namespaces alphabetically for stability
        const sortedNs = Array.from(resourcesByNs.keys()).sort();

         sortedNs.forEach(ns => {
             const bucket = resourcesByNs.get(ns)!;
             const nsNodes: Node<Record<string, unknown>, string>[] = [];
             const nsEdges: Edge<Record<string, unknown>>[] = [];

            // Map for connecting edges within this namespace
            const serviceMap = new Map<string, Record<string, string>>();

            // Service Nodes
            bucket.services.forEach(svc => {
                const name = svc.metadata.name;
                const id = `svc-${ns}-${name}`;
                const sel = svc.spec?.selector;
                if (sel) serviceMap.set(id, sel);

                 nsNodes.push({
                     id,
                     type: 'default',
                     parentId: `ns-group-${ns}`,
                     extent: 'parent',
                     data: {
                         label: `SVC: ${name}`,
                         type: 'Service',
                         fullResource: svc,
                         resourceInfo: {
                             group: "",
                             version: "v1",
                             kind: "Service",
                             name: "services",
                             namespaced: true
                         }
                     },
                     style: nodeStyles.Service,
                     position: { x: 0, y: 0 } as XYPosition
                 });
            });

            // Ingress Nodes & Edges to Services
            bucket.ingresses.forEach(ing => {
                const name = ing.metadata.name;
                const id = `ing-${ns}-${name}`;

                 nsNodes.push({
                     id,
                     type: "default",
                     parentId: `ns-group-${ns}`,
                     extent: 'parent',
                     data: {
                         label: `ING: ${name}`,
                         type: 'Ingress',
                         fullResource: ing,
                         resourceInfo: {
                             group: "networking.k8s.io",
                             version: "v1",
                             kind: "Ingress",
                             name: "ingresses",
                             namespaced: true
                         }
                     },
                     style: nodeStyles.Ingress,
                     position: { x: 0, y: 0 } as XYPosition,
                 });

                // Edges: Ingress -> Service
                ing.spec?.rules?.forEach((rule: any) => {
                    rule.http?.paths?.forEach((path: any) => {
                        const svcName = path.backend?.service?.name;
                        if (svcName) {
                            const targetId = `svc-${ns}-${svcName}`;
                         nsEdges.push({
                              id: `e-${id}-${targetId}`,
                              source: id,
                              target: targetId,
                              animated: true,
                              style: { stroke: '#d946ef' },
                          });
                        }
                    });
                });
            });

            // Pod Nodes & Edges from Services
            bucket.pods.forEach(pod => {
                const name = pod.metadata.name;
                const id = `pod-${ns}-${name}`;

                 nsNodes.push({
                     id,
                     type: 'default',
                     parentId: `ns-group-${ns}`,
                     extent: 'parent',
                     data: {
                         label: `POD: ${name}`,
                         type: 'Pod',
                         fullResource: pod,
                         resourceInfo: {
                             group: "",
                             version: "v1",
                             kind: "Pod",
                             name: "pods",
                             namespaced: true
                         }
                     },
                     style: nodeStyles.Pod,
                     position: { x: 0, y: 0 } as XYPosition
                 });

                // Edges: Service -> Pod
                const podLabels = pod.metadata.labels || {};
                serviceMap.forEach((selector, svcNodeId) => {
                 const matches = Object.entries(selector).every(([k, v]) => podLabels[k] === v);
                     if (matches) {
                         nsEdges.push({
                             id: `e-${svcNodeId}-${id}`,
                             source: svcNodeId,
                             target: id,
                             animated: true,
                             style: { stroke: '#34d399' }
                         });
                     }
                });
            });

            // If empty namespace, skip or show empty? 
            if (nsNodes.length === 0) return;

            // Layout the namespace contents
            const layout = layoutNamespaceContent(nsNodes, nsEdges);

            // Create Namespace Group Node
            const groupId = `ns-group-${ns}`;
            allNodes.push({
                id: groupId,
                type: 'namespace',
                data: { label: ns }, // Passing just the name, component adds styling
                style: {
                    ...nodeStyles.NamespaceGroup,
                    width: layout.width,
                    height: layout.height,
                },
                position: { x: 0, y: currentY },
            });

            // Add child nodes with adjusted positions
            layout.nodes.forEach(n => {
                // Ensure parentId is set (it was set above)
                allNodes.push(n);
            });

            // Add edges
            nsEdges.forEach(e => allEdges.push(e));

            // Move cursor
            currentY += layout.height + NS_PADDING;
        });

         // Set state
         setNodes((prev) => [...prev, ...allNodes]);
         setEdges((prev) => [...prev, ...allEdges]);

    }, [ingresses, services, pods, setNodes, setEdges]);

    // Handlers
    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            // Ignore clicks on group nodes for navigation, maybe just select them
            if (node.id.startsWith("ns-group-")) return;

            const info = node.data.resourceInfo as ApiResourceInfo;
            const res = node.data.fullResource as any;
            if (info && res) {
                onNavigate(info, res.metadata.name, res.metadata.namespace);
            }
        },
        [onNavigate]
    );

    if (loadingIngress || loadingService || loadingPod) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-8 text-slate-500">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p>Mapping Cluster Topology...</p>
            </div>
        );
    }

    return (
        <div style={{ width: "100%", height: "100%" }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                minZoom={0.1}
            >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
                <Controls />
                <Panel position="top-right">
                    <div className="bg-white/90 p-3 rounded-lg shadow-sm backdrop-blur border border-slate-200 text-xs">
                        <div className="font-semibold mb-2 text-slate-700">Cluster Map</div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-6 border border-dashed border-slate-400 bg-slate-50 rounded"></span>
                                <span className="text-slate-600">Namespace</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-fuchsia-100 border border-fuchsia-500"></span>
                                <span className="text-slate-600">Ingress</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-emerald-100 border border-emerald-500"></span>
                                <span className="text-slate-600">Service</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-blue-100 border border-blue-500"></span>
                                <span className="text-slate-600">Pod</span>
                            </div>
                        </div>
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    );
}
