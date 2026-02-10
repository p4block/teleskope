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
        refetchInterval: 1000,
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

/**
 * Delete a resource
 */
export function useDeleteResource() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, { group: string; version: string; kind: string; plural: string; namespace: string; name: string }, { previousResources?: Array<[any, any]>; previousResource?: any }>({
        mutationFn: (params) =>
            wailsInvoke<void>("DeleteResource", params.group, params.version, params.kind, params.plural, params.namespace, params.name),
        onMutate: async (params) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ["resources"] });
            await queryClient.cancelQueries({ queryKey: ["resource", params.group, params.version, params.kind, params.namespace, params.name] });

            // Snapshot the previous value - get the specific query for this resource type
            const listQueryKey = ["resources", {
                group: params.group,
                version: params.version,
                kind: params.kind,
                plural: params.plural,
                namespace: params.namespace || undefined,
                labelSelector: undefined
            }];
            const previousResources = queryClient.getQueryData(listQueryKey);
            const previousResource = queryClient.getQueryData(["resource", params.group, params.version, params.kind, params.namespace, params.name]);

            // Optimistically remove the resource from the list query
            console.log("Delete: Optimistic update for query key:", listQueryKey);
            queryClient.setQueryData(
                listQueryKey,
                (old: Record<string, unknown>[] | undefined) => {
                    console.log("Delete: Current resource list count:", old?.length);
                    if (!old) return old;
                    return old.filter(resource => {
                        const metadata = resource.metadata as Record<string, unknown> | undefined;
                        const resourceName = metadata?.name as string;
                        const resourceNamespace = metadata?.namespace as string;

                        // More precise matching - check name and namespace
                        if (resourceName !== params.name) {
                            return true; // Keep if names don't match
                        }

                        // For cluster-scoped resources: both should be falsy (empty/undefined)
                        const isClusterScoped = !params.namespace && !resourceNamespace;
                        if (isClusterScoped) {
                            return false; // Remove - this is the resource we're deleting
                        }

                        // For namespaced resources: namespaces must match
                        const shouldRemove = resourceNamespace === params.namespace;
                        if (shouldRemove) {
                            console.log("Delete: Removing resource:", resourceName);
                        }
                        return !shouldRemove; // Keep if namespaces don't match
                    });
                }
            );
            console.log("Delete: Optimistic update completed");

            // Remove the specific resource query
            queryClient.removeQueries({ queryKey: ["resource", params.group, params.version, params.kind, params.namespace, params.name] });

            return { previousResources: previousResources ? [[listQueryKey, previousResources]] : [], previousResource };
        },
        onError: (_err, params, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousResources) {
                context.previousResources.forEach(([queryKey, queryData]: [any, any]) => {
                    queryClient.setQueryData(queryKey, queryData);
                });
            }
            if (context?.previousResource) {
                queryClient.setQueryData(["resource", params.group, params.version, params.kind, params.namespace, params.name], context.previousResource);
            }
        },
        onSettled: () => {
            // Always refetch after error or success to make sure the server state is reflected
            console.log("Delete: Triggering refetch for all resource queries");
            queryClient.invalidateQueries({ queryKey: ["resources"] });
            // Force immediate refetch for all active resource queries
            queryClient.refetchQueries({ queryKey: ["resources"], type: "active" });
            // Also trigger a global refetch to be extra sure
            setTimeout(() => {
                queryClient.refetchQueries({ queryKey: ["resources"] });
            }, 100);
        },
    });
}

/**
 * Get pod logs
 */
export function usePodLogs() {
    return useMutation<string, Error, { namespace: string; podName: string; containerName?: string; follow?: boolean; tailLines?: number }>({
        mutationFn: (params) =>
            wailsInvoke<string>("GetPodLogs", {
                namespace: params.namespace,
                podName: params.podName,
                containerName: params.containerName || "",
                follow: params.follow || false,
                tailLines: params.tailLines || 100,
            }),
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
