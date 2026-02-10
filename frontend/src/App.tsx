import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "./components/Sidebar";
import { ContextSwitcher } from "./components/ContextSwitcher";
import { ResourceTable } from "./components/ResourceTable";
import { ResourceDetail } from "./components/ResourceDetail";
import type { ApiResourceInfo } from "./hooks/useKube";
import "./index.css";

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Selected resource detail info
interface SelectedDetail {
  resourceName: string;
  namespace: string | undefined;
  initialData?: Record<string, unknown>;
}

function AppContent() {
  const [selectedResource, setSelectedResource] = useState<ApiResourceInfo | null>(
    null
  );
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail | null>(null);

  // Handle resource type selection from sidebar
  const handleResourceSelect = (resource: ApiResourceInfo) => {
    setSelectedResource(resource);
    // Clear detail panel when switching resource types
    setSelectedDetail(null);
  };

  // Handle row click in table
  const handleRowClick = (
    resourceName: string,
    namespace: string | undefined,
    initialData?: Record<string, unknown>
  ) => {
    setSelectedDetail({ resourceName, namespace, initialData });
  };

  // Handle close detail panel
  const handleCloseDetail = () => {
    setSelectedDetail(null);
  };

  // Handle navigation from related resources
  const handleNavigate = (resource: ApiResourceInfo, name: string, namespace?: string) => {
    setSelectedResource(resource);
    setSelectedDetail({ resourceName: name, namespace });
  };

  return (
    <div className="app-container">
      {/* Sidebar with resource navigation */}
      <Sidebar
        onResourceSelect={handleResourceSelect}
        selectedResource={selectedResource}
      />

      {/* Main content area */}
      <main className="main-content">
        {/* Header bar with context switcher */}
        <header className="header-bar">
          <h2 className="header-title">
            {selectedResource ? selectedResource.kind : "Teleskope"}
          </h2>
          <ContextSwitcher />
        </header>

        {/* Content area with optional detail panel */}
        <div className={`content-area ${selectedDetail ? "content-with-detail" : ""}`}>
          {selectedResource ? (
            <>
              <div className={`content-main ${selectedDetail ? "with-detail" : ""}`}>
                <ResourceTable
                  resource={selectedResource}
                  onRowClick={handleRowClick}
                  selectedResourceName={selectedDetail?.resourceName}
                />
              </div>
              {selectedDetail && (
                <ResourceDetail
                  resource={selectedResource}
                  resourceName={selectedDetail.resourceName}
                  namespace={selectedDetail.namespace}
                  initialData={selectedDetail.initialData}
                  onClose={handleCloseDetail}
                  onNavigate={handleNavigate}
                />
              )}
            </>
          ) : (
            <WelcomeScreen />
          )}
        </div>
      </main>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="welcome-screen">
      <div className="welcome-icon">🔭</div>
      <h1 className="welcome-title">Welcome to Teleskope</h1>
      <p className="welcome-subtitle">
        A lightweight, fast Kubernetes IDE. Select a context and browse your
        resources using the sidebar.
      </p>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
