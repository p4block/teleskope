export namespace k8s {
	
	export class ApiResourceInfo {
	    group: string;
	    version: string;
	    kind: string;
	    name: string;
	    namespaced: boolean;
	    verbs: string[];
	    short_names: string[];
	    category: string;
	
	    static createFrom(source: any = {}) {
	        return new ApiResourceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.version = source["version"];
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.namespaced = source["namespaced"];
	        this.verbs = source["verbs"];
	        this.short_names = source["short_names"];
	        this.category = source["category"];
	    }
	}
	export class KubeContext {
	    name: string;
	    cluster: string;
	    user: string;
	    namespace: string;
	    is_current: boolean;
	
	    static createFrom(source: any = {}) {
	        return new KubeContext(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.cluster = source["cluster"];
	        this.user = source["user"];
	        this.namespace = source["namespace"];
	        this.is_current = source["is_current"];
	    }
	}

}

export namespace main {
	
	export class GetParams {
	    group: string;
	    version: string;
	    kind: string;
	    plural: string;
	    namespace: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new GetParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.version = source["version"];
	        this.kind = source["kind"];
	        this.plural = source["plural"];
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	    }
	}
	export class ListParams {
	    group: string;
	    version: string;
	    kind: string;
	    plural: string;
	    namespace: string;
	    label_selector: string;
	
	    static createFrom(source: any = {}) {
	        return new ListParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.version = source["version"];
	        this.kind = source["kind"];
	        this.plural = source["plural"];
	        this.namespace = source["namespace"];
	        this.label_selector = source["label_selector"];
	    }
	}
	export class LogsParams {
	    namespace: string;
	    podName: string;
	    containerName: string;
	    follow: boolean;
	    tailLines: number;
	
	    static createFrom(source: any = {}) {
	        return new LogsParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.namespace = source["namespace"];
	        this.podName = source["podName"];
	        this.containerName = source["containerName"];
	        this.follow = source["follow"];
	        this.tailLines = source["tailLines"];
	    }
	}
	export class RelatedParams {
	    group: string;
	    version: string;
	    kind: string;
	    namespace: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new RelatedParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.version = source["version"];
	        this.kind = source["kind"];
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	    }
	}

}

