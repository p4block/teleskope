import React, { useMemo, ReactNode } from "react";
import {
    useResource,
    useCopyToClipboard,
    useExecPod,
    useEditResource,
    useRelatedResources,
    type ApiResourceInfo
} from "../hooks/useKube";
import {
    resolveResourceProfile,
    extractValue,
    formatValue,
    formatAge,
    getStatusClass,
} from "../lib/profiles";
import { dump } from "js-yaml";

interface ResourceDetailProps {
    resource: ApiResourceInfo;
    resourceName: string;
    namespace: string | undefined;
    initialData?: Record<string, unknown>;
    onClose: () => void;
    onNavigate?: (resource: ApiResourceInfo, name: string, namespace?: string) => void;
}

export function ResourceDetail({
    resource,
    resourceName,
    namespace,
    initialData,
    onClose,
    onNavigate,
}: ResourceDetailProps) {
    const { data, isLoading, error } = useResource(
        resource.group,
        resource.version,
        resource.kind,
        resource.name,
        namespace,
        resourceName,
        true,
        initialData
    );

    const editResource = useEditResource();
    const execPod = useExecPod();
    const { data: related } = useRelatedResources(
        data ? {
            group: resource.group,
            version: resource.version,
            kind: resource.kind,
            namespace: namespace || "",
            name: resourceName
        } : null
    );

    const profile = useMemo(
        () =>
            resolveResourceProfile({
                group: resource.group,
                version: resource.version,
                kind: resource.kind,
            }),
        [resource]
    );

    const handleEdit = () => {
        editResource.mutate({
            group: resource.group,
            version: resource.version,
            kind: resource.kind,
            plural: resource.name,
            namespace: namespace || "",
            name: resourceName
        });
    };

    const handleExec = (containerName?: string) => {
        if (resource.kind === "Pod") {
            execPod.mutate({
                namespace: namespace || "default",
                podName: resourceName,
                containerName
            });
        }
    };

    // Get detail sections based on resource kind
    const detailSections = useMemo(() => {
        if (!data) return [];
        return getDetailSections(resource.kind, data, { onExec: handleExec });
    }, [resource.kind, data]);

    return (
        <div className="detail-panel">
            {/* Header */}
            <header className="detail-header">
                <div className="detail-header-content">
                    <span className="detail-kind-badge">{resource.kind}</span>
                    <h2 className="detail-title">{resourceName}</h2>
                    {namespace && (
                        <span className="detail-namespace">in {namespace}</span>
                    )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                        onClick={handleEdit}
                        title="Edit YAML in terminal"
                    >
                        Edit
                    </button>
                    <button className="detail-close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="detail-content">
                {isLoading ? (
                    <div className="loading-container">
                        <div className="loading-spinner" />
                        <span>Loading resource details...</span>
                    </div>
                ) : error ? (
                    <div className="error-container">
                        <strong>Error:</strong> {error.message}
                    </div>
                ) : data ? (
                    <>
                        {/* Quick info bar */}
                        <QuickInfoBar data={data} profile={profile} />

                        {/* Detail sections */}
                        {detailSections.map((section, index) => (
                            <DetailSection key={index} section={section} />
                        ))}

                        {/* Related Resources */}
                        {related && related.length > 0 && (
                            <section className="detail-section">
                                <h3 className="detail-section-title">Related Resources</h3>
                                <div className="detail-section-content">
                                    {related.map((res: any, i: number) => (
                                        <div key={i} className="detail-field">
                                            <span
                                                className="detail-field-value resource-link clickable"
                                                onClick={() => {
                                                    if (onNavigate) {
                                                        // We need the ApiResourceInfo for this resource
                                                        // For now, we'll construct a partial one or just rely on the navigate function
                                                        // A better way would be to pass the list of all API resources to lookup
                                                        const resKind = res.kind;
                                                        const resName = res.metadata.name;
                                                        const resNs = res.metadata.namespace;

                                                        // Construction for Pod is common
                                                        const info: ApiResourceInfo = {
                                                            group: res.apiVersion.split('/')[0] === res.apiVersion ? "" : res.apiVersion.split('/')[0],
                                                            version: res.apiVersion.split('/')[1] || res.apiVersion,
                                                            kind: resKind,
                                                            name: resKind.toLowerCase() + "s", // Crude pluralization
                                                            namespaced: !!resNs,
                                                            verbs: ["get", "list", "watch"],
                                                            short_names: [],
                                                            category: "Workloads"
                                                        };
                                                        onNavigate(info, resName, resNs);
                                                    }
                                                }}
                                            >
                                                {res.metadata.name} <span style={{ opacity: 0.5 }}>({res.kind})</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Labels & Annotations */}
                        <LabelsAnnotationsSection data={data} />

                        {/* Raw YAML toggle */}
                        <RawDataSection data={data} />
                    </>
                ) : null}
            </div>
        </div>
    );
}

// Quick info bar at the top
function QuickInfoBar({
    data,
    profile,
}: {
    data: Record<string, unknown>;
    profile: ReturnType<typeof resolveResourceProfile>;
}) {
    // Show first few important columns from profile
    const quickFields = profile.columns.slice(0, 4);

    return (
        <div className="detail-quick-info">
            {quickFields.map((col) => {
                const value = extractValue(data, col.path);
                const formatted = formatValue(value, col.type);
                const isStatus = col.type === "status";

                return (
                    <div key={col.header} className="quick-info-item">
                        <span className="quick-info-label">{col.header}</span>
                        {isStatus ? (
                            <span className={`status-badge ${getStatusClass(String(value))}`}>
                                {formatted}
                            </span>
                        ) : (
                            <span className="quick-info-value">{formatted}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// Section component
interface SectionData {
    title: string;
    items: Array<{ label: string; value: ReactNode }>;
}

function DetailSection({ section }: { section: SectionData }) {
    if (section.items.length === 0) return null;

    return (
        <section className="detail-section">
            <h3 className="detail-section-title">{section.title}</h3>
            <div className="detail-section-content">
                {section.items.map((item, index) => (
                    <div key={index} className="detail-field">
                        <span className="detail-field-label">{item.label}</span>
                        <span className="detail-field-value">{item.value}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}

// Labels & Annotations section
function LabelsAnnotationsSection({ data }: { data: Record<string, unknown> }) {
    const metadata = data.metadata as Record<string, unknown> | undefined;
    const labels = (metadata?.labels || {}) as Record<string, string>;
    const annotations = (metadata?.annotations || {}) as Record<string, string>;

    const labelEntries = Object.entries(labels);
    const annotationEntries = Object.entries(annotations).filter(
        ([key]) => !key.startsWith("kubectl.kubernetes.io")
    );

    return (
        <>
            {labelEntries.length > 0 && (
                <section className="detail-section">
                    <h3 className="detail-section-title">Labels</h3>
                    <div className="detail-tags">
                        {labelEntries.map(([key, value]) => (
                            <span key={key} className="detail-tag">
                                <span className="tag-key">{key}</span>
                                <span className="tag-value">{value}</span>
                            </span>
                        ))}
                    </div>
                </section>
            )}

            {annotationEntries.length > 0 && (
                <section className="detail-section">
                    <h3 className="detail-section-title">Annotations</h3>
                    <div className="detail-section-content">
                        {annotationEntries.slice(0, 5).map(([key, value]) => (
                            <div key={key} className="detail-field">
                                <span className="detail-field-label">{key}</span>
                                <span className="detail-field-value annotation-value">
                                    {value.length > 100 ? value.slice(0, 100) + "..." : value}
                                </span>
                            </div>
                        ))}
                        {annotationEntries.length > 5 && (
                            <div className="detail-field-more">
                                +{annotationEntries.length - 5} more annotations
                            </div>
                        )}
                    </div>
                </section>
            )}
        </>
    );
}

// Raw YAML section (collapsible)
function RawDataSection({ data }: { data: Record<string, unknown> }) {
    const [expanded, setExpanded] = React.useState(false);
    const copyToClipboard = useCopyToClipboard();

    const cleanData = useMemo(() => {
        if (!data) return data;
        const cleaned = JSON.parse(JSON.stringify(data));
        if (cleaned.metadata?.managedFields) {
            delete cleaned.metadata.managedFields;
        }
        return cleaned;
    }, [data]);

    return (
        <section className="detail-section">
            <h3
                className="detail-section-title clickable"
                onClick={() => setExpanded(!expanded)}
            >
                <span>{expanded ? "▼" : "▶"}</span>
                <span>Raw Data</span>
                <button
                    className="detail-copy-btn"
                    onClick={async (e) => {
                        e.stopPropagation();
                        const text = dump(cleanData, { indent: 2, lineWidth: -1 });
                        try {
                            await navigator.clipboard.writeText(text);
                        } catch (err) {
                            console.error("Clipboard API failed, trying our REST API", err);
                            copyToClipboard.mutate(text);
                        }
                        const btn = e.currentTarget as HTMLButtonElement;
                        const originalText = "📋";
                        btn.innerText = "✓";
                        setTimeout(() => { btn.innerText = originalText; }, 2000);
                    }}
                    title="Copy raw data to clipboard"
                >
                    📋
                </button>
            </h3>
            {expanded && (
                <pre className="detail-raw-data">
                    {dump(cleanData, { indent: 2, lineWidth: -1 })}
                </pre>
            )}
        </section>
    );
}

// ============================================
// Detail Section Generators (Handcrafted)
// ============================================

function getDetailSections(
    kind: string,
    data: Record<string, unknown>,
    actions: { onExec: (container?: string) => void }
): SectionData[] {
    const metadata = data.metadata as Record<string, unknown> | undefined;
    const spec = data.spec as Record<string, unknown> | undefined;
    const status = data.status as Record<string, unknown> | undefined;

    // Common metadata section
    const metadataSection: SectionData = {
        title: "Metadata",
        items: [
            { label: "Name", value: String(metadata?.name || "-") },
            { label: "Namespace", value: String(metadata?.namespace || "-") },
            { label: "UID", value: String(metadata?.uid || "-").slice(0, 8) + "..." },
            { label: "Created", value: formatAge(String(metadata?.creationTimestamp)) + " ago" },
            { label: "Resource Version", value: String(metadata?.resourceVersion || "-") },
        ],
    };

    // Kind-specific sections
    switch (kind) {
        case "Pod":
            return [metadataSection, ...getPodSections(spec, status, actions.onExec)];
        case "Deployment":
            return [metadataSection, ...getDeploymentSections(spec, status)];
        case "Service":
            return [metadataSection, ...getServiceSections(spec, status)];
        case "Ingress":
            return [metadataSection, ...getIngressSections(spec, status)];
        case "ConfigMap":
            return [metadataSection, ...getConfigMapSections(data)];
        case "Secret":
            return [metadataSection, ...getSecretSections(data)];
        default:
            return [metadataSection, ...getGenericSections(spec, status)];
    }
}

function getPodSections(
    spec: Record<string, unknown> | undefined,
    status: Record<string, unknown> | undefined,
    onExec: (container?: string) => void
): SectionData[] {
    const containers = (spec?.containers || []) as Array<Record<string, unknown>>;
    const containerStatuses = (status?.containerStatuses || []) as Array<Record<string, unknown>>;

    return [
        {
            title: "Pod Status",
            items: [
                { label: "Phase", value: String(status?.phase || "-") },
                { label: "Pod IP", value: String(status?.podIP || "-") },
                { label: "Host IP", value: String(status?.hostIP || "-") },
                { label: "Node", value: String(spec?.nodeName || "-") },
                { label: "QoS Class", value: String(status?.qosClass || "-") },
            ],
        },
        {
            title: "Containers",
            items: containers.map((c, i) => {
                const containerStatus = containerStatuses[i] as Record<string, unknown> | undefined;
                const ready = containerStatus?.ready ? "✓" : "✗";
                const restarts = containerStatus?.restartCount || 0;
                return {
                    label: String(c.name),
                    value: (
                        <div key={String(c.name)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <span style={{ fontSize: "0.75rem" }}>{`${String(c.image).split('/').pop()} | Ready: ${ready} | Restarts: ${restarts}`}</span>
                            <button
                                className="btn btn-secondary"
                                style={{ padding: "0.125rem 0.375rem", fontSize: "0.625rem" }}
                                onClick={() => onExec(String(c.name))}
                            >
                                Exec
                            </button>
                        </div>
                    ) as ReactNode,
                };
            }),
        },
    ];
}

function getDeploymentSections(
    spec: Record<string, unknown> | undefined,
    status: Record<string, unknown> | undefined
): SectionData[] {
    return [
        {
            title: "Deployment Status",
            items: [
                { label: "Replicas", value: `${status?.readyReplicas || 0} / ${spec?.replicas || 0}` },
                { label: "Updated", value: String(status?.updatedReplicas || 0) },
                { label: "Available", value: String(status?.availableReplicas || 0) },
                { label: "Strategy", value: String((spec?.strategy as Record<string, unknown>)?.type || "-") },
            ],
        },
    ];
}

function getServiceSections(
    spec: Record<string, unknown> | undefined,
    _status: Record<string, unknown> | undefined
): SectionData[] {
    const ports = (spec?.ports || []) as Array<Record<string, unknown>>;

    return [
        {
            title: "Service Configuration",
            items: [
                { label: "Type", value: String(spec?.type || "ClusterIP") },
                { label: "Cluster IP", value: String(spec?.clusterIP || "-") },
                { label: "Session Affinity", value: String(spec?.sessionAffinity || "None") },
            ],
        },
        {
            title: "Ports",
            items: ports.map((p) => ({
                label: String(p.name || p.port),
                value: String(`${p.port}${p.targetPort ? " → " + p.targetPort : ""} (${p.protocol || "TCP"})`),
            })),
        },
    ];
}

function getIngressSections(
    spec: Record<string, unknown> | undefined,
    status: Record<string, unknown> | undefined
): SectionData[] {
    const rules = (spec?.rules || []) as Array<Record<string, unknown>>;
    const ingress = ((status?.loadBalancer as Record<string, unknown>)?.ingress || []) as Array<Record<string, unknown>>;

    return [
        {
            title: "Ingress Configuration",
            items: [
                { label: "Class", value: String(spec?.ingressClassName || "-") },
                { label: "Address", value: ingress.map((i) => i.ip || i.hostname).join(", ") || "-" },
            ],
        },
        {
            title: "Rules",
            items: rules.map((r) => {
                const http = r.http as Record<string, unknown> | undefined;
                const paths = (http?.paths || []) as Array<Record<string, unknown>>;
                return {
                    label: String(r.host || "*"),
                    value: String(paths.map((p) => String(p.path || "/")).join(", ")),
                };
            }),
        },
    ];
}

function getConfigMapSections(data: Record<string, unknown>): SectionData[] {
    const dataMap = (data.data || {}) as Record<string, string>;
    const keys = Object.keys(dataMap);

    return [
        {
            title: "Data Keys",
            items: keys.map((key) => ({
                label: key,
                value: String(dataMap[key].length > 50 ? dataMap[key].slice(0, 50) + "..." : dataMap[key]),
            })),
        },
    ];
}

function getSecretSections(data: Record<string, unknown>): SectionData[] {
    const secretData = (data.data || {}) as Record<string, string>;
    const keys = Object.keys(secretData);

    return [
        {
            title: "Secret Info",
            items: [
                { label: "Type", value: String(data.type || "Opaque") },
            ],
        },
        {
            title: "Data Keys",
            items: keys.map((key) => ({
                label: key,
                value: String("••••••••" + ` (${secretData[key].length} base64 chars)`),
            })),
        },
    ];
}

function getGenericSections(
    spec: Record<string, unknown> | undefined,
    status: Record<string, unknown> | undefined
): SectionData[] {
    const sections: SectionData[] = [];

    if (spec && Object.keys(spec).length > 0) {
        sections.push({
            title: "Spec",
            items: Object.entries(spec).slice(0, 8).map(([key, value]) => ({
                label: key,
                value: String(typeof value === "object" ? JSON.stringify(value).slice(0, 50) + "..." : String(value)),
            })),
        });
    }

    if (status && Object.keys(status).length > 0) {
        sections.push({
            title: "Status",
            items: Object.entries(status).slice(0, 8).map(([key, value]) => ({
                label: key,
                value: String(typeof value === "object" ? JSON.stringify(value).slice(0, 50) + "..." : String(value)),
            })),
        });
    }

    return sections;
}
