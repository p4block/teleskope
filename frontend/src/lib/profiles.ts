import { JSONPath } from "jsonpath-plus";

// ============================================
// Types
// ============================================

export interface GVK {
    group: string;
    version: string;
    kind: string;
}

export interface ColumnDefinition {
    header: string;
    path: string; // JSONPath expression
    type: "text" | "link" | "age" | "status" | "pod-enhanced-status" | "list" | "boolean" | "number" | "container-statuses";
    width?: string;
}

export interface ActionDefinition {
    label: string;
    type: "edit" | "delete" | "view" | "terminal" | "open-url" | "custom";
    icon?: string;
    urlPath?: string; // For open-url action
}

export interface ResourceProfile {
    gvk: GVK;
    columns: ColumnDefinition[];
    actions?: ActionDefinition[];
}

// ============================================
// Native Profiles (Hardcoded for core K8s types)
// ============================================

const NATIVE_PROFILES: Map<string, ResourceProfile> = new Map([
    // Pods
    [
        "core/v1/Pod",
        {
            gvk: { group: "", version: "v1", kind: "Pod" },
            columns: [
                { header: "Status", path: "$", type: "pod-enhanced-status", width: "40px" },
                { header: "Name", path: "$.metadata.name", type: "link" },
                { header: "Containers", path: "$.status.containerStatuses[*]", type: "container-statuses" },
                { header: "Node", path: "$.spec.nodeName", type: "text" },
                { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
            ],
            actions: [
                { label: "View Logs", type: "view" },
                { label: "Terminal", type: "terminal" },
                { label: "Edit", type: "edit" },
                { label: "Delete", type: "delete" },
            ],
        },
    ],

    // Deployments
    [
        "apps/v1/Deployment",
        {
            gvk: { group: "apps", version: "v1", kind: "Deployment" },
            columns: [
                { header: "Name", path: "$.metadata.name", type: "link" },
                { header: "Namespace", path: "$.metadata.namespace", type: "text" },
                { header: "Ready", path: "$.status.readyReplicas", type: "text" },
                { header: "Up-to-date", path: "$.status.updatedReplicas", type: "number" },
                { header: "Available", path: "$.status.availableReplicas", type: "number" },
                { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
            ],
            actions: [
                { label: "Scale", type: "custom" },
                { label: "Edit", type: "edit" },
                { label: "Delete", type: "delete" },
            ],
        },
    ],

    // Services
    [
        "core/v1/Service",
        {
            gvk: { group: "", version: "v1", kind: "Service" },
            columns: [
                { header: "Name", path: "$.metadata.name", type: "link" },
                { header: "Namespace", path: "$.metadata.namespace", type: "text" },
                { header: "Type", path: "$.spec.type", type: "text" },
                { header: "Cluster IP", path: "$.spec.clusterIP", type: "text" },
                { header: "External IP", path: "$.status.loadBalancer.ingress[0].ip", type: "text" },
                { header: "Ports", path: "$.spec.ports[*].port", type: "list" },
                { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
            ],
        },
    ],

    // Ingresses
    [
        "networking.k8s.io/v1/Ingress",
        {
            gvk: { group: "networking.k8s.io", version: "v1", kind: "Ingress" },
            columns: [
                { header: "Name", path: "$.metadata.name", type: "link" },
                { header: "Namespace", path: "$.metadata.namespace", type: "text" },
                { header: "Class", path: "$.spec.ingressClassName", type: "text" },
                { header: "Hosts", path: "$.spec.rules[*].host", type: "list" },
                { header: "Address", path: "$.status.loadBalancer.ingress[0].ip", type: "text" },
                { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
            ],
        },
    ],

    // ConfigMaps
    [
        "core/v1/ConfigMap",
        {
            gvk: { group: "", version: "v1", kind: "ConfigMap" },
            columns: [
                { header: "Name", path: "$.metadata.name", type: "link" },
                { header: "Namespace", path: "$.metadata.namespace", type: "text" },
                { header: "Data", path: "$.data", type: "text" },
                { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
            ],
        },
    ],

    // Secrets
    [
        "core/v1/Secret",
        {
            gvk: { group: "", version: "v1", kind: "Secret" },
            columns: [
                { header: "Name", path: "$.metadata.name", type: "link" },
                { header: "Namespace", path: "$.metadata.namespace", type: "text" },
                { header: "Type", path: "$.type", type: "text" },
                { header: "Data", path: "$.data", type: "text" },
                { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
            ],
        },
    ],

    // Namespaces
    [
        "core/v1/Namespace",
        {
            gvk: { group: "", version: "v1", kind: "Namespace" },
            columns: [
                { header: "Name", path: "$.metadata.name", type: "link" },
                { header: "Status", path: "$.status.phase", type: "status" },
                { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
            ],
        },
    ],

    // Nodes
    [
        "core/v1/Node",
        {
            gvk: { group: "", version: "v1", kind: "Node" },
            columns: [
                { header: "Name", path: "$.metadata.name", type: "link" },
                { header: "Status", path: "$.status.conditions[?(@.type=='Ready')].status", type: "status" },
                { header: "Roles", path: "$.metadata.labels['kubernetes.io/role']", type: "text" },
                { header: "Version", path: "$.status.nodeInfo.kubeletVersion", type: "text" },
                { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
            ],
        },
    ],

    // StatefulSets
    [
        "apps/v1/StatefulSet",
        {
            gvk: { group: "apps", version: "v1", kind: "StatefulSet" },
            columns: [
                { header: "Name", path: "$.metadata.name", type: "link" },
                { header: "Namespace", path: "$.metadata.namespace", type: "text" },
                { header: "Ready", path: "$.status.readyReplicas", type: "text" },
                { header: "Replicas", path: "$.spec.replicas", type: "number" },
                { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
            ],
        },
    ],

    // DaemonSets
    [
        "apps/v1/DaemonSet",
        {
            gvk: { group: "apps", version: "v1", kind: "DaemonSet" },
            columns: [
                { header: "Name", path: "$.metadata.name", type: "link" },
                { header: "Namespace", path: "$.metadata.namespace", type: "text" },
                { header: "Desired", path: "$.status.desiredNumberScheduled", type: "number" },
                { header: "Current", path: "$.status.currentNumberScheduled", type: "number" },
                { header: "Ready", path: "$.status.numberReady", type: "number" },
                { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
            ],
        },
    ],

    // Jobs
    [
        "batch/v1/Job",
        {
            gvk: { group: "batch", version: "v1", kind: "Job" },
            columns: [
                { header: "Name", path: "$.metadata.name", type: "link" },
                { header: "Namespace", path: "$.metadata.namespace", type: "text" },
                { header: "Completions", path: "$.status.succeeded", type: "number" },
                { header: "Duration", path: "$.status.completionTime", type: "text" },
                { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
            ],
        },
    ],

    // CronJobs
    [
        "batch/v1/CronJob",
        {
            gvk: { group: "batch", version: "v1", kind: "CronJob" },
            columns: [
                { header: "Name", path: "$.metadata.name", type: "link" },
                { header: "Namespace", path: "$.metadata.namespace", type: "text" },
                { header: "Schedule", path: "$.spec.schedule", type: "text" },
                { header: "Suspend", path: "$.spec.suspend", type: "boolean" },
                { header: "Active", path: "$.status.active.length", type: "number" },
                { header: "Last Schedule", path: "$.status.lastScheduleTime", type: "age" },
                { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
            ],
        },
    ],
]);

// ============================================
// Profile Resolution (Priority Order)

/**
 * Generate a profile key from GVK
 */
function getProfileKey(gvk: GVK): string {
    const group = gvk.group || "core";
    return `${group}/${gvk.version}/${gvk.kind}`;
}

/**
 * Get fallback generic profile for unknown resource types
 */
function getGenericProfile(gvk: GVK): ResourceProfile {
    return {
        gvk,
        columns: [
            { header: "Name", path: "$.metadata.name", type: "link" },
            { header: "Namespace", path: "$.metadata.namespace", type: "text" },
            { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
        ],
    };
}

/**
 * Resolve the best profile for a given GVK
 *
 * Priority:
 * 1. Native profiles (hardcoded)
 * 2. User profiles (from ~/.config/teleskope/profiles/)
 * 3. Discovery API (additionalPrinterColumns from CRD)
 * 4. Generic fallback
 */
export function resolveResourceProfile(gvk: GVK): ResourceProfile {
    const key = getProfileKey(gvk);

    // 1. Check native profiles
    const nativeProfile = NATIVE_PROFILES.get(key);
    if (nativeProfile) {
        return nativeProfile;
    }

    // 2. TODO: Check user profiles from config directory
    // TODO: Load user-defined profiles from ~/.config/teleskope/profiles/

    // 3. TODO: Check additionalPrinterColumns from CRD spec
    // TODO: Parse CRD's additionalPrinterColumns for custom resources

    // 4. Generic fallback
    return getGenericProfile(gvk);
}

// ============================================
// Data Extraction
// ============================================

/**
 * Extract value from resource using JSONPath
 */
export function extractValue(resource: Record<string, unknown>, path: string): unknown {
    try {
        const result = JSONPath({ path, json: resource, wrap: false });
        return result;
    } catch {
        return undefined;
    }
}

/**
 * Format a value based on column type
 */
export function formatValue(value: unknown, type: ColumnDefinition["type"]): string {
    if (value === undefined || value === null) {
        return "-";
    }

    switch (type) {
        case "age":
            return formatAge(value as string);

        case "pod-enhanced-status":
            const podResource = value as Record<string, unknown>;
            const podStatus = getPodStatus(podResource);
            const podIcon = getStatusIcon(podStatus);
            return podIcon;

        case "status":
            const status = String(value);
            const icon = getStatusIcon(status);
            return icon;

        case "list":
            if (Array.isArray(value)) {
                return value.join(", ");
            }
            return String(value);

        case "boolean":
            return value ? "Yes" : "No";

        case "number":
            return String(value ?? 0);

        case "text":
        case "link":
        default:
            if (typeof value === "object") {
                return Object.keys(value as object).length + " items";
            }
            return String(value);
    }
}

/**
 * Format a timestamp as human-readable age
 */
export function formatAge(timestamp: string): string {
    if (!timestamp) return "-";

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays}d`;
    }
    if (diffHours > 0) {
        return `${diffHours}h`;
    }
    if (diffMins > 0) {
        return `${diffMins}m`;
    }
    return `${diffSecs}s`;
}

/**
 * Get CSS class for status badge
 */
export function getStatusClass(status: string): string {
    const normalized = status?.toLowerCase().replace(/[\s-]/g, "") || "";

    if (["running", "active", "healthy", "ready", "true", "succeeded"].includes(normalized)) {
        return "running";
    }
    if (["pending", "progressing", "waiting", "containercreating", "terminating"].includes(normalized)) {
        return "pending";
    }
    if (["failed", "error", "crashloopbackoff", "imagepullbackoff", "false", "terminated", "error"].includes(normalized)) {
        return "failed";
    }
    if (["terminating"].includes(normalized)) {
        return "terminating";
    }
    return "unknown";
}

/**
 * Get icon for status
 */
export function getStatusIcon(status: string): string {
    const normalized = status?.toLowerCase().replace(/[\s-]/g, "") || "";

    if (["running", "active", "healthy", "ready", "true", "succeeded"].includes(normalized)) {
        return "✓";
    }
    if (["pending", "progressing", "waiting", "containercreating"].includes(normalized)) {
        return "⟳";
    }
    if (["failed", "error", "crashloopbackoff", "imagepullbackoff", "false", "terminated", "error"].includes(normalized)) {
        return "✕";
    }
    if (["terminating"].includes(normalized)) {
        return "⏸";
    }
    return "?";
}

/**
 * Get pod status including termination state
 */
export function getPodStatus(resource: Record<string, unknown>): string {
    if (!resource) return "Unknown";

    const metadata = resource.metadata as Record<string, unknown> | undefined;
    const status = resource.status as Record<string, unknown> | undefined;

    // Check if pod is being deleted
    if (metadata?.deletionTimestamp) {
        return "Terminating";
    }

    // Get phase from status
    const phase = String(status?.phase || "").trim();
    if (phase) {
        // Capitalize first letter
        return phase.charAt(0).toUpperCase() + phase.slice(1).toLowerCase();
    }

    return "Unknown";
}
