import { useEffect, useState } from "react";
import {
    useKubeContexts,
    useCurrentContext,
    useSetActiveContext,
    useInitDefaultContext,
} from "../hooks/useKube";

export function ContextSwitcher() {
    const { data: contexts, isLoading: contextsLoading } = useKubeContexts();
    const { data: currentContext } = useCurrentContext();
    const setContext = useSetActiveContext();
    const initDefault = useInitDefaultContext();
    const [selectedContext, setSelectedContext] = useState<string>("");

    // Initialize with default context on mount
    useEffect(() => {
        if (!currentContext && contexts && contexts.length > 0) {
            initDefault.mutate();
        }
    }, [contexts, currentContext, initDefault]);

    // Sync selected context with current context
    useEffect(() => {
        if (currentContext) {
            setSelectedContext(currentContext);
        }
    }, [currentContext]);

    const handleContextChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newContext = e.target.value;
        setSelectedContext(newContext);
        setContext.mutate(newContext);
    };

    const isConnected = !!currentContext;

    if (contextsLoading) {
        return (
            <div className="context-switcher">
                <div className="loading-spinner" style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                    Loading contexts...
                </span>
            </div>
        );
    }

    return (
        <div className="context-switcher">
            <select
                className="context-select"
                value={selectedContext}
                onChange={handleContextChange}
                disabled={setContext.isPending}
            >
                {!selectedContext && <option value="">Select a context...</option>}
                {contexts?.map((ctx) => (
                    <option key={ctx.name} value={ctx.name}>
                        {ctx.name}
                    </option>
                ))}
            </select>
            <div className={`context-status ${isConnected ? "connected" : ""}`}>
                <span className="status-dot" />
                <span>{isConnected ? "Connected" : "Disconnected"}</span>
            </div>
        </div>
    );
}
