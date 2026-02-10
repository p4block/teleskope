package k8s

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

type Client struct {
	Config          clientcmd.ClientConfig
	Clientset       *kubernetes.Clientset
	DynamicClient   dynamic.Interface
	DiscoveryClient *discovery.DiscoveryClient
}

type KubeContext struct {
	Name      string `json:"name"`
	Cluster   string `json:"cluster"`
	User      string `json:"user"`
	Namespace string `json:"namespace"`
	IsCurrent bool   `json:"is_current"`
}

type ApiResourceInfo struct {
	Group      string   `json:"group"`
	Version    string   `json:"version"`
	Kind       string   `json:"kind"`
	Name       string   `json:"name"`
	Namespaced bool     `json:"namespaced"`
	Verbs      []string `json:"verbs"`
	ShortNames []string `json:"short_names"`
	Category   string   `json:"category"`
}

func NewK8sClient() (*Client, error) {
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		home, _ := os.UserHomeDir()
		kubeconfig = filepath.Join(home, ".kube", "config")
	}

	config := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		&clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfig},
		&clientcmd.ConfigOverrides{},
	)

	return &Client{Config: config}, nil
}

func (c *Client) Init() error {
	restConfig, err := c.Config.ClientConfig()
	if err != nil {
		return err
	}

	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return err
	}

	dynamicClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return err
	}

	discoveryClient, err := discovery.NewDiscoveryClientForConfig(restConfig)
	if err != nil {
		return err
	}

	c.Clientset = clientset
	c.DynamicClient = dynamicClient
	c.DiscoveryClient = discoveryClient

	return nil
}

func (c *Client) GetContexts() ([]KubeContext, error) {
	rawConfig, err := c.Config.RawConfig()
	if err != nil {
		return nil, err
	}

	var contexts []KubeContext
	for name, ctx := range rawConfig.Contexts {
		contexts = append(contexts, KubeContext{
			Name:      name,
			Cluster:   ctx.Cluster,
			User:      ctx.AuthInfo,
			Namespace: ctx.Namespace,
			IsCurrent: name == rawConfig.CurrentContext,
		})
	}

	sort.Slice(contexts, func(i, j int) bool {
		return contexts[i].Name < contexts[j].Name
	})

	return contexts, nil
}

func (c *Client) SetContext(name string) error {
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		home, _ := os.UserHomeDir()
		kubeconfig = filepath.Join(home, ".kube", "config")
	}

	c.Config = clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		&clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfig},
		&clientcmd.ConfigOverrides{CurrentContext: name},
	)

	return c.Init()
}

func (c *Client) GetCurrentContext() (string, error) {
	rawConfig, err := c.Config.RawConfig()
	if err != nil {
		return "", err
	}
	return rawConfig.CurrentContext, nil
}

func (c *Client) GetApiResources() ([]ApiResourceInfo, error) {
	_, resources, err := c.DiscoveryClient.ServerGroupsAndResources()
	if err != nil {
		return nil, err
	}

	var infos []ApiResourceInfo
	for _, resList := range resources {
		gv, _ := schema.ParseGroupVersion(resList.GroupVersion)
		for _, res := range resList.APIResources {
			if contains(res.Verbs, "list") {
				infos = append(infos, ApiResourceInfo{
					Group:      gv.Group,
					Version:    gv.Version,
					Kind:       res.Kind,
					Name:       res.Name,
					Namespaced: res.Namespaced,
					Verbs:      res.Verbs,
					ShortNames: res.ShortNames,
					Category:   CategorizeResource(gv.Group, res.Kind),
				})
			}
		}
	}

	sort.Slice(infos, func(i, j int) bool {
		if infos[i].Category != infos[j].Category {
			return infos[i].Category < infos[j].Category
		}
		return infos[i].Kind < infos[j].Kind
	})

	return infos, nil
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func CategorizeResource(group, kind string) string {
	switch kind {
	case "Pod", "Deployment", "ReplicaSet", "StatefulSet", "DaemonSet", "Job", "CronJob":
		return "Workloads"
	case "Service", "Endpoints", "Ingress", "NetworkPolicy", "IngressClass":
		return "Network"
	case "PersistentVolume", "PersistentVolumeClaim", "StorageClass", "VolumeAttachment":
		return "Storage"
	case "ConfigMap", "Secret", "ResourceQuota", "LimitRange", "HorizontalPodAutoscaler":
		return "Config"
	case "ServiceAccount", "Role", "RoleBinding", "ClusterRole", "ClusterRoleBinding":
		return "RBAC"
	case "Namespace", "Node", "Event":
		return "Cluster"
	}

	if group != "" {
		return fmt.Sprintf("CRDs (%s)", group)
	}

	return "Other"
}

func (c *Client) ListResources(group, version, kind, plural, namespace, labelSelector string) ([]interface{}, error) {
	gv := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: plural,
	}

	var list *unstructured.UnstructuredList
	var err error

	opts := metav1.ListOptions{
		LabelSelector: labelSelector,
	}

	if namespace != "" {
		list, err = c.DynamicClient.Resource(gv).Namespace(namespace).List(context.TODO(), opts)
	} else {
		list, err = c.DynamicClient.Resource(gv).List(context.TODO(), opts)
	}

	if err != nil {
		return nil, err
	}

	var result []interface{}
	for _, item := range list.Items {
		result = append(result, item.Object)
	}

	return result, nil
}

func (c *Client) GetResource(group, version, kind, plural, namespace, name string) (interface{}, error) {
	gv := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: plural,
	}

	var res *unstructured.Unstructured
	var err error

	if namespace != "" {
		res, err = c.DynamicClient.Resource(gv).Namespace(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	} else {
		res, err = c.DynamicClient.Resource(gv).Get(context.TODO(), name, metav1.GetOptions{})
	}

	if err != nil {
		return nil, err
	}

	return res.Object, nil
}

func (c *Client) GetNamespaces() ([]string, error) {
	list, err := c.Clientset.CoreV1().Namespaces().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var names []string
	for _, ns := range list.Items {
		names = append(names, ns.Name)
	}
	sort.Strings(names)
	return names, nil
}

func (c *Client) ExecPod(namespace, podName, containerName string) error {
	term, args := findTerminal()
	if term == "" {
		return fmt.Errorf("no terminal emulator found")
	}

	currentContext, _ := c.GetCurrentContext()
	kCmd := fmt.Sprintf("kubectl exec -it %s -n %s", podName, namespace)
	if currentContext != "" {
		kCmd = fmt.Sprintf("kubectl --context %s exec -it %s -n %s", currentContext, podName, namespace)
	}

	if containerName != "" {
		kCmd = fmt.Sprintf("%s -c %s", kCmd, containerName)
	}
	kCmd = kCmd + " -- sh -c 'command -v bash >/dev/null && exec bash || exec sh'"

	fmt.Printf("Executing Pod: %s in terminal %s\n", kCmd, term)

	// Open in a shell within the terminal to handle the command better
	shCmd := fmt.Sprintf("%s", kCmd)
	fullArgs := append(args, shCmd)
	cmd := exec.Command(term, fullArgs...)
	return cmd.Start()
}

func (c *Client) EditResource(group, version, kind, plural, namespace, name string) error {
	term, args := findTerminal()
	if term == "" {
		return fmt.Errorf("no terminal emulator found")
	}

	currentContext, _ := c.GetCurrentContext()
	kCmd := fmt.Sprintf("kubectl edit %s/%s -n %s", plural, name, namespace)
	if namespace == "" {
		kCmd = fmt.Sprintf("kubectl edit %s/%s", plural, name)
	}
	if currentContext != "" {
		if namespace != "" {
			kCmd = fmt.Sprintf("kubectl --context %s edit %s/%s -n %s", currentContext, plural, name, namespace)
		} else {
			kCmd = fmt.Sprintf("kubectl --context %s edit %s/%s", currentContext, plural, name)
		}
	}

	fmt.Printf("Editing resource: %s in terminal %s\n", kCmd, term)

	fullArgs := append(args, kCmd)
	cmd := exec.Command(term, fullArgs...)
	return cmd.Start()
}

func (c *Client) GetRelatedResources(group, version, kind, namespace, name string) ([]interface{}, error) {
	// Simple implementation:
	// Deployment -> Pods (via selector)
	// CronJob -> Jobs
	// Job -> Pods

	// We'll use a switch on Kind instead

	switch kind {
	case "Deployment", "ReplicaSet", "StatefulSet", "DaemonSet":
		plural := strings.ToLower(kind) + "s"
		if kind == "Ingress" { // This case is not hit by the current switch, but kept as per instruction
			plural = "ingresses"
		}
		// For dynamic client we need the plural name.
		// Since we don't have a full mapping here, we'll try a common one
		// but a better way is to pass it from the frontend or have a lookup map.

		res, err := c.GetResource(group, version, kind, plural, namespace, name)
		if err != nil {
			fmt.Printf("Error getting parent resource: %v\n", err)
			return nil, err
		}
		obj := res.(map[string]interface{})
		spec, ok := obj["spec"].(map[string]interface{})
		if !ok {
			return nil, nil
		}
		selector, ok := spec["selector"].(map[string]interface{})
		if !ok {
			return nil, nil
		}
		matchLabels, ok := selector["matchLabels"].(map[string]interface{})
		if !ok {
			return nil, nil
		}

		var labelSelectors []string
		for k, v := range matchLabels {
			labelSelectors = append(labelSelectors, fmt.Sprintf("%s=%v", k, v))
		}

		var selectorStr string
		for i, s := range labelSelectors {
			if i > 0 {
				selectorStr += ","
			}
			selectorStr += s
		}

		return c.ListResources("", "v1", "Pod", "pods", namespace, selectorStr)
	}

	return nil, nil
}

func findTerminal() (string, []string) {
	terminals := []struct {
		name string
		args []string
	}{
		{"alacritty", []string{"-e", "sh", "-c"}},
		{"kitty", []string{"sh", "-c"}},
		{"konsole", []string{"-e", "sh", "-c"}},
		{"gnome-terminal", []string{"--", "sh", "-c"}},
		{"xfce4-terminal", []string{"-e", "sh", "-c"}},
		{"xterm", []string{"-e", "sh", "-c"}},
	}
	for _, t := range terminals {
		path, err := exec.LookPath(t.name)
		if err == nil {
			return path, t.args
		}
	}
	return "", nil
}
