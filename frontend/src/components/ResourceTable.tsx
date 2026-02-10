import { useState, useMemo, useRef, useEffect } from "react";
import {
    useReactTable,
    getSortedRowModel,
    getFilteredRowModel,
    getCoreRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from "@tanstack/react-table";
import { useResources, useNamespaces, type ApiResourceInfo, type ListResourcesParams } from "../hooks/useKube";
import {
    resolveResourceProfile,
    extractValue,
    formatValue,
    getStatusClass,
    type ColumnDefinition,
} from "../lib/profiles";

interface ResourceTableProps {
    resource: ApiResourceInfo;
    onRowClick?: (
        resourceName: string,
        namespace: string | undefined,
        initialData?: Record<string, unknown>
    ) => void;
    selectedResourceName?: string | null;
}

type ResourceRow = Record<string, unknown>;

export function ResourceTable({ resource, onRowClick, selectedResourceName }: ResourceTableProps) {
    const [namespace, setNamespace] = useState<string>("all");
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const { data: namespaces } = useNamespaces();

    const params = useMemo<ListResourcesParams | null>(() => {
        if (!resource) return null;
        return {
            group: resource.group,
            version: resource.version,
            kind: resource.kind,
            plural: resource.name,
            namespace: namespace === "all" ? undefined : namespace,
        };
    }, [resource, namespace]);

    const { data: resources, isLoading, error } = useResources(params);

    const profile = useMemo(
        () =>
            resolveResourceProfile({
                group: resource.group,
                version: resource.version,
                kind: resource.kind,
            }),
        [resource]
    );

    const allColumns = useMemo(() => {
        return profile.columns.map((col) => ({
            id: col.header,
            label: col.header,
            hidden: columnVisibility[col.header] === true,
        }));
    }, [profile, columnVisibility]);

    const visibleColumns = useMemo<ColumnDef<ResourceRow>[]>(() => {
        return profile.columns
            .filter((col) => columnVisibility[col.header] !== true)
            .map((col: ColumnDefinition) => ({
                id: col.header,
                header: col.header,
                accessorFn: (row: ResourceRow) => extractValue(row, col.path),
                cell: ({ getValue }) => {
                    const value = getValue();
                    const formatted = formatValue(value, col.type);

                    if (col.type === "status") {
                        const statusClass = getStatusClass(String(value));
                        return (
                            <span className={`status-badge ${statusClass}`}>
                                {formatted}
                            </span>
                        );
                    }

                    if (col.type === "link") {
                        return <span className="resource-link">{formatted}</span>;
                    }

                    if (col.type === "age") {
                        return <span className="age-display">{formatted}</span>;
                    }

                    if (col.type === "container-statuses") {
                        const containerStatuses = Array.isArray(value) ? value : [];
                        return (
                            <div className="container-statuses">
                                {containerStatuses.map((container: Record<string, unknown>, index: number) => {
                                    const state = container.state as Record<string, unknown> | undefined;
                                    const currentState = state?.running
                                        ? "running"
                                        : state?.waiting
                                            ? "waiting"
                                            : state?.terminated
                                                ? "terminated"
                                                : "pending";
                                    const isRunning = currentState === "running";
                                    const isWaiting = currentState === "waiting";
                                    const isError = currentState === "terminated" || currentState === "waiting";
                                    const statusClass = isRunning
                                        ? "running"
                                        : isWaiting
                                            ? "warning"
                                            : isError
                                                ? "failed"
                                                : "pending";
                                    return (
                                        <div
                                            key={index}
                                            className={`container-status status-badge ${statusClass}`}
                                            title={
                                                [
                                                    "running",
                                                    "waiting",
                                                    "terminated",
                                                    "pending",
                                                ].includes(currentState)
                                                    ? currentState
                                                    : currentState
                                            }
                                        />
                                    );
                                })}
                            </div>
                        );
                    }

                    return formatted;
                },
            }));
    }, [profile, columnVisibility]);

    const toggleColumnVisibility = (columnId: string) => {
        setColumnVisibility((prev) => ({
            ...prev,
            [columnId]: !prev[columnId],
        }));
    };

    const resetToDefaults = () => {
        setColumnVisibility({});
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowColumnMenu(false);
            }
        };
        if (showColumnMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showColumnMenu]);

    const table = useReactTable({
        data: resources || [],
        columns: visibleColumns,
        state: {
            sorting,
            globalFilter,
            columnVisibility,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    const handleRowClick = (row: ResourceRow) => {
        const metadata = row.metadata as Record<string, unknown> | undefined;
        const name = String(metadata?.name || "");
        const ns = metadata?.namespace as string | undefined;
        if (onRowClick && name) {
            onRowClick(name, ns);
        }
    };

    const isRowSelected = (row: ResourceRow) => {
        const metadata = row.metadata as Record<string, unknown> | undefined;
        return metadata?.name === selectedResourceName;
    };

    if (error) {
        return (
            <div className="error-container">
                <strong>Error loading resources:</strong>
                <p>{error.message}</p>
            </div>
        );
    }

    return (
        <div>
            {/* Header with namespace selector, search, and column menu */}
            <div className="table-header-controls">
                {resource.namespaced && (
                    <div className="namespace-selector">
                        <label style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                            Namespace:
                        </label>
                        <select
                            className="namespace-select"
                            value={namespace}
                            onChange={(e) => setNamespace(e.target.value)}
                        >
                            <option value="all">All Namespaces</option>
                            {namespaces?.map((ns) => (
                                <option key={ns} value={ns}>
                                    {ns}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <input
                    type="text"
                    placeholder="Search..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    style={{
                        background: "var(--color-bg-secondary)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "6px",
                        padding: "0.5rem 0.75rem",
                        color: "var(--color-text-primary)",
                        fontSize: "0.875rem",
                        width: "200px",
                    }}
                />

                <div style={{ position: "relative" }} ref={menuRef}>
                    <button
                        onClick={() => setShowColumnMenu(!showColumnMenu)}
                        style={{
                            background: "var(--color-bg-secondary)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "6px",
                            padding: "0.5rem 0.75rem",
                            color: "var(--color-text-primary)",
                            fontSize: "0.875rem",
                            cursor: "pointer",
                        }}
                    >
                        Columns
                    </button>

                    {showColumnMenu && (
                        <div
                            style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                background: "var(--color-bg-secondary)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "6px",
                                padding: "0.5rem",
                                minWidth: "200px",
                                zIndex: 1000,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                            }}
                        >
                            <h4
                                style={{
                                    margin: "0 0 0.5rem 0",
                                    fontSize: "0.75rem",
                                    color: "var(--color-text-muted)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                }}
                            >
                                Show/Hide Columns
                            </h4>
                            <div
                                style={{
                                    maxHeight: "200px",
                                    overflowY: "auto",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.25rem",
                                }}
                            >
                                {allColumns.map((col) => (
                                    <label
                                        key={col.id}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.5rem",
                                            fontSize: "0.875rem",
                                            cursor: "pointer",
                                            padding: "0.25rem 0",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={!col.hidden}
                                            onChange={() =>
                                                toggleColumnVisibility(col.id)
                                            }
                                            style={{
                                                width: "14px",
                                                height: "14px",
                                                cursor: "pointer",
                                            }}
                                        />
                                        <span>{col.label}</span>
                                    </label>
                                ))}
                            </div>
                            <div
                                style={{
                                    marginTop: "0.5rem",
                                    paddingTop: "0.5rem",
                                    borderTop: "1px solid var(--color-border)",
                                }}
                            >
                                <button
                                    onClick={resetToDefaults}
                                    style={{
                                        width: "100%",
                                        background: "var(--color-accent)",
                                        border: "none",
                                        borderRadius: "4px",
                                        padding: "0.375rem 0.75rem",
                                        color: "white",
                                        fontSize: "0.75rem",
                                        cursor: "pointer",
                                    }}
                                >
                                    Reset to Defaults
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <span
                    style={{
                        marginLeft: "auto",
                        fontSize: "0.75rem",
                        color: "var(--color-text-muted)",
                    }}
                >
                    {resources?.length ?? 0} items
                </span>
            </div>

            {/* Table */}
            <div className="resource-table-container">
                {isLoading ? (
                    <div className="loading-container">
                        <div className="loading-spinner" />
                        <span>Loading resources...</span>
                    </div>
                ) : !resources || resources.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <p>No {resource.kind} resources found</p>
                    </div>
                ) : (
                    <table className="resource-table">
                        <thead>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            onClick={header.column.getToggleSortingHandler()}
                                            style={{ cursor: "pointer" }}
                                        >
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                            {header.column.getIsSorted() === "asc" && " ▲"}
                                            {header.column.getIsSorted() === "desc" && " ▼"}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    onClick={() => handleRowClick(row.original)}
                                    className={isRowSelected(row.original) ? "selected" : ""}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
