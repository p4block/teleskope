package main

import (
	"context"
	"fmt"
	"teleskope/pkg/k8s"
)

// App struct
type App struct {
	ctx       context.Context
	k8sClient *k8s.Client
}

// NewApp creates a new App application struct
func NewApp() *App {
	client, err := k8s.NewK8sClient()
	if err != nil {
		fmt.Printf("Error creating k8s client: %v\n", err)
	}
	return &App{
		k8sClient: client,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if a.k8sClient != nil {
		_ = a.k8sClient.Init()
	}
}

// Kubeconfig methods

func (a *App) GetKubeContexts() ([]k8s.KubeContext, error) {
	return a.k8sClient.GetContexts()
}

func (a *App) GetCurrentContext() (string, error) {
	return a.k8sClient.GetCurrentContext()
}

func (a *App) SetActiveContext(name string) error {
	return a.k8sClient.SetContext(name)
}

func (a *App) InitDefaultContext() (string, error) {
	err := a.k8sClient.Init()
	if err != nil {
		return "", err
	}
	return a.k8sClient.GetCurrentContext()
}

// Resource methods

func (a *App) GetApiResources() ([]k8s.ApiResourceInfo, error) {
	return a.k8sClient.GetApiResources()
}

func (a *App) GetNamespaces() ([]string, error) {
	return a.k8sClient.GetNamespaces()
}

type ListParams struct {
	Group         string `json:"group"`
	Version       string `json:"version"`
	Kind          string `json:"kind"`
	Plural        string `json:"plural"`
	Namespace     string `json:"namespace"`
	LabelSelector string `json:"label_selector"`
}

func (a *App) ListResources(params ListParams) ([]interface{}, error) {
	return a.k8sClient.ListResources(params.Group, params.Version, params.Kind, params.Plural, params.Namespace, params.LabelSelector)
}

type GetParams struct {
	Group     string `json:"group"`
	Version   string `json:"version"`
	Kind      string `json:"kind"`
	Plural    string `json:"plural"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

func (a *App) GetResource(params GetParams) (interface{}, error) {
	return a.k8sClient.GetResource(params.Group, params.Version, params.Kind, params.Plural, params.Namespace, params.Name)
}

func (a *App) CopyToClipboard(text string) error {
	// Wails usually handles clipboard via runtime or we can use shell
	return nil // TODO: implement if needed
}

func (a *App) ExecPod(namespace, podName, containerName string) error {
	return a.k8sClient.ExecPod(namespace, podName, containerName)
}

func (a *App) EditResource(group, version, kind, plural, namespace, name string) error {
	return a.k8sClient.EditResource(group, version, kind, plural, namespace, name)
}

type RelatedParams struct {
	Group     string `json:"group"`
	Version   string `json:"version"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

func (a *App) GetRelatedResources(params RelatedParams) ([]interface{}, error) {
	return a.k8sClient.GetRelatedResources(params.Group, params.Version, params.Kind, params.Namespace, params.Name)
}
