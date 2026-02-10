import { useState, useMemo } from "react";
import {
    useApiResources,
    useCurrentContext,
    groupResourcesByCategory,
    type ApiResourceInfo,
} from "../hooks/useKube";

interface SidebarProps {
    onResourceSelect: (resource: ApiResourceInfo) => void;
    selectedResource: ApiResourceInfo | null;
}

// Category order for sidebar
const CATEGORY_ORDER = [
    "Workloads",
    "Network",
    "Config",
    "Storage",
    "RBAC",
    "Cluster",
];

// Icons for categories
const CATEGORY_ICONS: Record<string, string> = {
    Workloads: "📦",
    Network: "🌐",
    Config: "⚙️",
    Storage: "💾",
    RBAC: "🔐",
    Cluster: "🖥️",
    Other: "📋",
};

export function Sidebar({ onResourceSelect, selectedResource }: SidebarProps) {
    const { data: currentContext } = useCurrentContext();
    const { data: resources, isLoading, error } = useApiResources(!!currentContext);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set(["Workloads", "Network"])
    );

    const groupedResources = useMemo(() => {
        if (!resources) return new Map();
        return groupResourcesByCategory(resources);
    }, [resources]);

    // Sort categories by predefined order
    const sortedCategories = useMemo(() => {
        const categories = Array.from(groupedResources.keys());
        return categories.sort((a, b) => {
            const aIndex = CATEGORY_ORDER.indexOf(a);
            const bIndex = CATEGORY_ORDER.indexOf(b);
            if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
            if (aIndex >= 0) return -1;
            if (bIndex >= 0) return 1;
            return a.localeCompare(b);
        });
    }, [groupedResources]);

    const toggleCategory = (category: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    const isResourceSelected = (resource: ApiResourceInfo) => {
        return (
            selectedResource?.group === resource.group &&
            selectedResource?.version === resource.version &&
            selectedResource?.kind === resource.kind
        );
    };

    return (
        <aside className="sidebar">
            <header className="sidebar-header">
                <h1 className="sidebar-title">
                    <span>🔭</span>
                    <span>Teleskope</span>
                </h1>
            </header>

            <nav className="sidebar-content">
                {!currentContext ? (
                    <div className="empty-state" style={{ padding: "1rem" }}>
                        <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                            Select a context to browse resources
                        </p>
                    </div>
                ) : isLoading ? (
                    <div className="loading-container" style={{ padding: "1rem" }}>
                        <div className="loading-spinner" />
                        <span>Discovering APIs...</span>
                    </div>
                ) : error ? (
                    <div className="sidebar-error" style={{ padding: "1rem", color: "var(--color-status-failed)" }}>
                        <strong>Error:</strong> {error.message}
                    </div>
                ) : (
                    sortedCategories.map((category) => {
                        const categoryResources = groupedResources.get(category) || [];
                        const isExpanded = expandedCategories.has(category);
                        const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.Other;

                        return (
                            <section key={category} className="sidebar-section">
                                <div
                                    className="sidebar-section-title"
                                    onClick={() => toggleCategory(category)}
                                >
                                    <span>{isExpanded ? "▼" : "▶"}</span>
                                    <span>{icon}</span>
                                    <span>{category}</span>
                                    <span style={{ marginLeft: "auto", opacity: 0.5 }}>
                                        {categoryResources.length}
                                    </span>
                                </div>
                                {isExpanded && (
                                    <div className="sidebar-items">
                                        {categoryResources.map((resource: ApiResourceInfo) => (
                                            <div
                                                key={`${resource.group}/${resource.version}/${resource.kind}`}
                                                className={`sidebar-item ${isResourceSelected(resource) ? "active" : ""}`}
                                                onClick={() => onResourceSelect(resource)}
                                            >
                                                {resource.kind}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        );
                    })
                )}
            </nav>
        </aside>
    );
}
