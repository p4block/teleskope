# Project Plan: Teleskope (Go + Wails Native App)

## 1. Project Overview
**Teleskope** is a high-performance Kubernetes IDE built with **Go** and **React** using the **Wails** framework. It provides a native desktop experience without the resource overhead of Electron, focusing on automation and GitOps workflows.

*   **Goal:** A fast, native desktop app for managing Kubernetes clusters.
*   **Architecture:** Go backend (using official `client-go`) + React frontend.
*   **Distribution:** Single binary containing the bundled frontend.

## 2. Technical Stack
*   **Backend:** Go + Wails v2.
*   **K8s Library:** `k8s.io/client-go` (Industry Standard).
*   **Frontend:** React + TailwindCSS + TanStack Table (Virtualized).
*   **Styling:** Tailwind CSS 4.0.

---

## 3. Extensible Resource Registry
Teleskope uses a **Tiered UI Engine** to resolve how Kubernetes resources are displayed:

1.  **Native Profiles:** Optimized views for core types (Pods, Deployments, Services).
2.  **User Profiles:** YAML/JSON definitions in `~/.config/teleskope/profiles/`.
3.  **Discovery API:** Fallback to `additionalPrinterColumns` from CRD specs.
4.  **Generic Fallback:** Basic Name/Namespace/Age view.

---

## 4. MVP Implementation Phases

### Phase 1: Core Architecture ✅ COMPLETE
*   [x] **Wails Integration:** Migrated from Rust/Axum to Go/Wails.
*   [x] **Native K8s Logic:** Implemented `client-go` backend in `pkg/k8s`.
*   [x] **Frontend Bindings:** Connected React hooks to Go methods via Wails JS bindings.
*   [x] **Unified Script:** `run.sh` updated to use `wails dev`.

### Phase 2: Dynamic Resource Discovery ✅ COMPLETE
*   [x] **API Discovery:** Backend logic using Go's discovery client.
*   [x] **Dynamic Sidebar:** React sidebar that adapts to cluster-provided APIs.
*   [x] **Context Switching:** Full support for switching kubeconfig contexts via the UI.

### Phase 3: Resource Viewer ✅ COMPLETE
*   [x] **Generic Lister:** Go logic using `dynamic` client to list any resource type.
*   [x] **Frontend Profile Resolver:** choosing the best column layout for any GVK.
*   [x] **Virtualized Table:** high-performance filtering for "insane amounts of garbage."

### Phase 4: Automation & GitOps (Next Steps)
*   **[ ] GitOps Integration:**
    *   Add a local Git listener to detect drift between repo manifests and the cluster.
    *   Show "OutOfSync" badges in the resource table.
*   **[ ] Activity Macros:**
    *   Implement common tasks like "Restart all Pods in Namespace" or "Clean up Evicted Pods" as one-click Go functions.
*   **[ ] Resource Editing:**
    *   Launch the system editor (e.g., VS Code/Vim) for YAML editing.

### Phase 5: Polish & Deployment
*   [ ] **Single Binary Build:** Package for Linux (AppImage/Binary).
*   [ ] **Status Notifications:** Native desktop notifications for cluster events.
*   [ ] **Watch Logic:** Replace polling with Wails-event-driven watchers.

---

## 5. Execution Model
1. **Development:** `bash run.sh` (runs `wails dev`).
2. **Production:** `wails build` creates a single, self-contained binary (~20MB).
