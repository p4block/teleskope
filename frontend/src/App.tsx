import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "./components/Sidebar";
import { ContextSwitcher } from "./components/ContextSwitcher";
import { ResourceTable } from "./components/ResourceTable";
import { ResourceDetail } from "./components/ResourceDetail";
import { Dashboard } from "./components/Dashboard";
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
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1280);
  const [currentView, setCurrentView] = useState<"resources" | "dashboard">("resources");

  useEffect(() => {
    const handler = () => setIsLargeScreen(window.innerWidth >= 1280);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const [selectedResource, setSelectedResource] =
    useState<ApiResourceInfo | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail | null>(
    null,
  );
  const [detailPanelOpen, setDetailPanelOpen] = useState(true);

  // Sync detail panel state with screen size
  useEffect(() => {
    setDetailPanelOpen(isLargeScreen);
  }, [isLargeScreen]);

  // Handle Escape key to close sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDetailPanelOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle row click in table
  const handleRowClick = (
    resourceName: string,
    namespace: string | undefined,
    initialData?: Record<string, unknown>,
  ) => {
    setSelectedDetail({ resourceName, namespace, initialData });
    setDetailPanelOpen(true);
  };

  // Handle resource selection from sidebar
  const handleResourceSelect = (resource: ApiResourceInfo) => {
    setCurrentView("resources");
    setSelectedResource(resource);
    setSelectedDetail(null);
  };

  const handleDashboardSelect = () => {
    setCurrentView("dashboard");
    setSelectedResource(null);
    setSelectedDetail(null);
  };

  // Handle toggling detail panel
  const handleToggleDetailPanel = () => {
    setDetailPanelOpen((prev) => !prev);
  };

  // Handle navigation from related resources
  const handleNavigate = (
    resource: ApiResourceInfo,
    name: string,
    namespace?: string,
  ) => {
    setSelectedResource(resource);
    setSelectedDetail({ resourceName: name, namespace });
    setDetailPanelOpen(true);
  };

  return (
    <div className="app-container">
      {/* Sidebar with resource navigation */}
      <Sidebar
        onResourceSelect={handleResourceSelect}
        onDashboardSelect={handleDashboardSelect}
        selectedResource={selectedResource}
        currentView={currentView}
      />

      {/* Main content area */}
      <main className="main-content">
        {/* Header bar with context switcher */}
        <header className="header-bar">
          <h2 className="header-title">
            {currentView === "dashboard" ? "Cluster Map" : selectedResource ? selectedResource.kind : "Teleskope"}
          </h2>
          <ContextSwitcher />
        </header>

        {/* Content area with optional detail panel */}
        <div
          className={`content-area ${detailPanelOpen ? "content-with-detail" : ""}`}
        >
          {currentView === "dashboard" ? (
            <>
              <div
                className={`content-main ${detailPanelOpen ? "with-detail" : ""}`}
                style={{ padding: 0, overflow: "hidden" }}
              >
                <Dashboard onNavigate={handleNavigate} />
              </div>
              {detailPanelOpen && selectedResource && (
                <ResourceDetail
                  resource={selectedResource}
                  resourceName={selectedDetail?.resourceName}
                  namespace={selectedDetail?.namespace}
                  initialData={selectedDetail?.initialData}
                  onClose={handleToggleDetailPanel}
                  onNavigate={handleNavigate}
                />
              )}
            </>
          ) : selectedResource ? (
            <>
              <div
                className={`content-main ${detailPanelOpen ? "with-detail" : ""}`}
              >
                <ResourceTable
                  resource={selectedResource}
                  onRowClick={handleRowClick}
                  selectedResourceName={selectedDetail?.resourceName}
                />
              </div>
              {detailPanelOpen && (
                <ResourceDetail
                  resource={selectedResource}
                  resourceName={selectedDetail?.resourceName}
                  namespace={selectedDetail?.namespace}
                  initialData={selectedDetail?.initialData}
                  onClose={handleToggleDetailPanel}
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
