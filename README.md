# Teleskope

A lightweight desktop Kubernetes IDE vibe coded with Go and React.

<img width="1598" height="893" alt="image" src="https://github.com/user-attachments/assets/a05b2975-05ad-48b0-8e38-0818616296f4" />

## Why Teleskope?

- **Native Performance**: Built with Wails v2 (not Electron) for minimal footprint (~20MB binary)
- **Kubernetes-Native**: Leverages official `client-go` for direct cluster interaction
- **Zero Configuration**: Auto-discovery of resources via Kubernetes APIs
- **Scalable UI**: Virtualized data tables handle thousands of resources without lag

## Key Features

- **Tiered UI Engine** (Native → User → Discovery):
  - Predefined views for core resources (Pods, Deployments, Services)
  - Customizable profiles via JSON/YAML in `~/.config/teleskope/profiles/`
  - Fallback to Kubernetes `additionalPrinterColumns`
- **Dynamic Resource Discovery**:
  - Auto-detects new CRDs and APIs in cluster
  - Context-switching without restarting
- **Real-time Clusters**:
  - Watch-based updates (no polling)
  - GitOps drift detection (planned for v1.1)

## Tech Stack

| Category       | Technology              |
|----------------|-------------------------|
| Backend        | Go, `client-go`, Wails  |
| Frontend       | React, TailwindCSS 4, TanStack Table |
| Data Binding   | Wails-native Go<->JS    |
| Build          | `wails build` (single binary) |

## Development

```bash
# Start dev server with hot reload
bash run.sh

# Build production binary
wails build
```

### Project Structure

```
teleskope/
├── frontend/   # React UI (Vite + Tailwind)
├── pkg/k8s/    # Kubernetes core logic (Go)
├── main.go     # Wails app entry
├── app.go      # Exposed Go methods
└── PLAN.md     # Roadmap (see below)
```

## Contributing
This is vibe coded, so probably make an issue or PR and some bot will figure it out.
