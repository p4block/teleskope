# AGENTS.md - Teleskope Project Guide (Wails Edition)

## Project Overview

**Teleskope** is a lightweight Kubernetes IDE built with:
- **Backend:** Go + `client-go` (Official library)
- **Frontend:** React + TailwindCSS + TanStack Table (Vite)
- **Framework:** **Wails v2** (Native Desktop App)
- **Communication:** Native Go-to-JS bindings (window.go.main.App)

## Directory Structure

```
teleskope/
├── frontend/           # React frontend
│   ├── src/
│   │   ├── hooks/          # React Query hooks calling Wails bindings
│   │   ├── components/     # UI Components
│   │   ├── lib/            # Shared logic (profiles, formatting)
│   │   └── main.tsx        # React entry
│   ├── index.html          # Vite entry path
│   ├── package.json        # Frontend dependencies
│   ├── vite.config.ts      # Vite configuration
│   └── wailsjs/            # Auto-generated JS bindings for Go code
├── pkg/
│   └── k8s/                # Kubernetes core logic (Go)
├── build/              # Native build assets (icons, etc.)
├── main.go             # Wails application entry
├── app.go              # Exposed Go methods for the frontend
├── wails.json          # Wails project configuration
├── run.sh              # Unified dev script
└── PLAN.md             # Project roadmap
```

## Key Concepts

### 1. Wails Bindings
Unlike traditional REST APIs, Wails generates JavaScript bindings for any public method on the `App` struct in `app.go`. 
The frontend calls these via:
```typescript
window.go.main.App.FunctionName(args)
```

### 2. Tiered UI Engine (Resource profiles)
Resources are rendered based on priority:
1. **Native Profiles** - Optimized views in `frontend/src/lib/profiles.ts`.
2. **User Profiles** - External JSON files in `~/.config/teleskope/profiles/` (TODO).
3. **Discovery API** - Fallback to `additionalPrinterColumns`.

### 3. Native Kubernetes Integration
By using `client-go`, Teleskope has first-class access to all Kubernetes features, including local kubeconfig discovery and efficient dynamic resource listing.

## Common Tasks

### Running in Dev Mode
This starts the Wails dev environment with HMR and Go hot-reloading:
```bash
bash run.sh
```

### Building for Release
```bash
wails build
```

### Adding a new Backend Method
1. Add a public method to the `App` struct in `app.go`.
2. Run `wails dev` to auto-generate the JS bindings.
3. Call it from `frontend/src/hooks/useKube.ts`.

### Adding a new native profile
Edit `frontend/src/lib/profiles.ts`:
```typescript
NATIVE_PROFILES.set("group/version/Kind", {
  gvk: { group: "group", version: "version", kind: "Kind" },
  columns: [
    { header: "Name", path: "$.metadata.name", type: "link" },
    { header: "Age", path: "$.metadata.creationTimestamp", type: "age" },
  ],
});
```

## Dependencies

### Backend (Go)
- `github.com/wailsapp/wails/v2` - App framework
- `k8s.io/client-go` - Official K8s client
- `k8s.io/apimachinery` - K8s types and utils

### Frontend
- `@tanstack/react-table` - Data grid
- `@tanstack/react-query` - State sync
- `jsonpath-plus` - Data extraction from unstructured objects
- `tailwindcss` v4 - Styling
