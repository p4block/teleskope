import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Wails bindings are globally available on window.go.main.App
// We can use them directly or import them from wailsjs/go/main/App
// To avoid build issues with missing generated files, we'll use a wrapper

async function wailsInvoke<T>(cmd: string, ...args: any[]): Promise<T> {
    const app = (window as any).go?.main?.App;
    if (!app) {
        // If wails is not loaded (e.g. in dev browser), try to fallback or error
        console.warn("Wails App not found, make sure you are running in Wails");
        throw new Error("Wails App not found");
    }

    const command = app[cmd];
    if (typeof command !== 'function') {
        throw new Error(`Command ${cmd} not found on App`);
    }

    return command(...args);
}

// Types matching Go structs
export interface KubeContext {
    name: string;
    cluster: string;
    user: string;
    namespace: string | null;
    is_current: boolean;
}

export interface ApiResourceInfo {
    group: string;
    version: string;
    kind: string;
    name: string;
    namespaced: boolean;
    verbs: string[];
    short_names: string[];
    category: string;
}

export interface ListResourcesParams {
    group: string;
    version: string;
    kind: string;
    plural: string;
    namespace?: string;
    label_selector?: string;
}

// ============================================
// Kubeconfig Hooks
// ============================================

/**
 * Fetch all available Kubernetes contexts
 */
export function useKubeContexts() {
    return useQuery<KubeContext[], Error>({
        queryKey: ["kube-contexts"],
        queryFn: () => wailsInvoke<KubeContext[]>("GetKubeContexts"),
        staleTime: 60000,
    });
}

/**
 * Get currently active context
 */
export function useCurrentContext() {
    return useQuery<string | null, Error>({
        queryKey: ["current-context"],
        queryFn: () => wailsInvoke<string | null>("GetCurrentContext"),
    });
}

/**
 * Switch to a different context
 */
export function useSetActiveContext() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, string>({
        mutationFn: (contextName: string) =>
            wailsInvoke<void>("SetActiveContext", contextName),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["current-context"] });
            queryClient.invalidateQueries({ queryKey: ["api-resources"] });
            queryClient.invalidateQueries({ queryKey: ["namespaces"] });
            queryClient.invalidateQueries({ queryKey: ["resources"] });
        },
    });
}

/**
 * Initialize with the default context from kubeconfig
 */
export function useInitDefaultContext() {
    const queryClient = useQueryClient();

    return useMutation<string, Error>({
        mutationFn: () => wailsInvoke<string>("InitDefaultContext"),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["current-context"] });
            queryClient.invalidateQueries({ queryKey: ["api-resources"] });
            queryClient.invalidateQueries({ queryKey: ["namespaces"] });
        },
    });
}

// ============================================
// Resource Discovery Hooks
// ============================================

/**
 * Fetch all available API resources in the cluster
 */
export function useApiResources(enabled = true) {
    return useQuery<ApiResourceInfo[], Error>({
        queryKey: ["api-resources"],
        queryFn: () => wailsInvoke<ApiResourceInfo[]>("GetApiResources"),
        enabled,
        staleTime: 300000,
    });
}

/**
 * Fetch available namespaces
 */
export function useNamespaces(enabled = true) {
    return useQuery<string[], Error>({
        queryKey: ["namespaces"],
        queryFn: () => wailsInvoke<string[]>("GetNamespaces"),
        enabled,
        staleTime: 60000,
    });
}

// ============================================
// Resource Listing Hooks
// ============================================

/**
 * List resources of a specific type
 */
export function useResources(params: ListResourcesParams | null) {
    return useQuery<Record<string, unknown>[], Error>({
        queryKey: ["resources", params],
        queryFn: () => {
            if (!params) throw new Error("No params provided");
            return wailsInvoke<Record<string, unknown>[]>("ListResources", params);
        },
        enabled: !!params,
        refetchInterval: 10000,
    });
}

/**
 * Get a single resource
 */
export function useResource(
    group: string,
    version: string,
    kind: string,
    plural: string,
    namespace: string | undefined,
    name: string,
    enabled = true,
    initialData?: Record<string, unknown>
) {
    return useQuery<Record<string, unknown>, Error>({
        queryKey: ["resource", group, version, kind, namespace, name],
        queryFn: () =>
            wailsInvoke<Record<string, unknown>>("GetResource", {
                group,
                version,
                kind,
                plural,
                namespace,
                name,
            }),
        enabled: enabled && !!name,
        initialData,
    });
}

/**
 * Copy to clipboard
 */
export function useCopyToClipboard() {
    return useMutation<void, Error, string>({
        mutationFn: (text: string) => wailsInvoke<void>("CopyToClipboard", text),
    });
}

/**
 * Exec into a pod
 */
export function useExecPod() {
    return useMutation<void, Error, { namespace: string; podName: string; containerName?: string }>({
        mutationFn: ({ namespace, podName, containerName }) =>
            wailsInvoke<void>("ExecPod", namespace, podName, containerName || ""),
    });
}

/**
 * Edit a resource
 */
export function useEditResource() {
    return useMutation<void, Error, { group: string; version: string; kind: string; plural: string; namespace: string; name: string }>({
        mutationFn: (params) =>
            wailsInvoke<void>("EditResource", params.group, params.version, params.kind, params.plural, params.namespace, params.name),
    });
}

/**
 * Fetch related resources (e.g. Deployment -> Pods)
 */
export function useRelatedResources(params: { group: string; version: string; kind: string; namespace: string; name: string } | null) {
    return useQuery<Record<string, unknown>[], Error>({
        queryKey: ["related-resources", params],
        queryFn: () => {
            if (!params) throw new Error("No params provided");
            return wailsInvoke<Record<string, unknown>[]>("GetRelatedResources", params);
        },
        enabled: !!params,
    });
}

// ============================================
// Utility Functions
// ============================================

/**
 * Group API resources by category
 */
export function groupResourcesByCategory(
    resources: ApiResourceInfo[]
): Map<string, ApiResourceInfo[]> {
    const grouped = new Map<string, ApiResourceInfo[]>();

    for (const resource of resources) {
        const category = resource.category;
        if (!grouped.has(category)) {
            grouped.set(category, []);
        }
        grouped.get(category)!.push(resource);
    }

    return grouped;
}
