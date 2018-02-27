//// PROCESS GRAPH CREATION ////
class ProcessGraphNode {
	constructor() { }

	filter_daterange(startT, endT, imagery = null) {
		return new ProcessNode('filter_daterange', {
			imagery: (imagery ? imagery : this),
			from: startT,
			to: endT
		});
	}

	filter_bbox(left, top, right, bottom, crs = 'EPSG:4326', imagery = null) {
		imagery = imagery ? imagery : this;
		return new ProcessNode('filter_bbox', {
			imagery: (imagery ? imagery : this),
			srs: crs,
			left: left,
			right: right,
			top: top,
			bottom: bottom
		});
	}

	filter_bands(bands, imagery = null) {
		return new ProcessNode('filter_bands', {
			imagery: (imagery ? imagery : this),
			bands: bands
		});
		// ToDo: add band names and wavelength filters
	}

	NDVI(first, second, imagery = null) {
		return new ProcessNode('NDVI', {
			imagery: (imagery ? imagery : this),
			band1: first,
			band2: second
		});
	}

	min_time(imagery = null) {
		return new ProcessNode('min_time', {
			imagery: (imagery ? imagery : this)
		});
	}

	max_time(imagery = null) {
		return new ProcessNode('max_time', {
			imagery: (imagery ? imagery : this)
		});
	}
	
	udf(language, process_id, script, imagery = null) {
		return new UdfProcessNode(language, process_id, script, imagery);
	}
	
	zonal_statistics(regionsPath, func, imagery = null) {
		return new ProcessNode('zonal_statistics', {
			imagery: (imagery ? imagery : this),
			regions: regionsPath,
			func: func
		});
	}
	
	custom(process_id, args, processParameterName, imagery = null) {
		// ToDo: Improve? Doesn't seem very tidy (changing an object from outer scope).
		args[processParameterName] = (imagery ? imagery : this);
		return new ProcessNode(process_id, args);
	}
	
	execute(output_args = {}) {
		return OpenEO.HTTP.post('/execute', {
			process_graph: this, 
			output: output_args
		});
	}
	
}

class ProcessNode extends ProcessGraphNode {
	constructor(process_id, args) {
		super();
		this.process_id = process_id;
		this.args = args;
	}
}

class UdfProcessNode extends ProcessNode {
	constructor(language, process_id, script, imagery = null) {
		super('udf/' + language + '/' + process_id, {
			imagery: (imagery ? imagery : this),
			script: script
		});
	}
	
}

class ImageCollectionNode extends ProcessGraphNode {
	constructor(srcId) {
		super();
		this.product_id = srcId;
	}
}

//// API SUB-COMPONENTS ////
class UserAPI {
	
	constructor(user_id) {
		this.user_id = user_id;
	}
	
	getProcessGraphs() {
		return OpenEO.HTTP.get('/users/' + this.user_id + '/process_graphs');
	}
	
	createProcessGraph(process_graph) {
		throw new Error('Not implemented');
	}
	
	getProcessGraphObject(process_graph_id) {
		return new UserProcessGraphAPI(this.user_id, process_graph_id);
	}
	
	getFiles() {
		return OpenEO.HTTP.get('/users/' + this.user_id + '/files');
	}
	
	getFileObject(path) {
		return new UserFileAPI(this.user_id, path);
	}
	
	getJobs() {
		return OpenEO.HTTP.get('/users/' + this.user_id + '/jobs');
	}
	
	getServices() {
		return OpenEO.HTTP.get('/users/' + this.user_id + '/services');
	}
	
	getCredits() {
		return OpenEO.HTTP.get('/users/' + this.user_id + '/credits');
	}
	
}

class UserProcessGraphAPI {
	
	constructor(user_id, process_graph_id) {
		this.user_id = user_id;
		this.process_graph_id = process_graph_id;
	}
	
	get() {
		throw new Error('Not implemented');
	}
	
	replace(process_graph) {
		throw new Error('Not implemented');
	}
	
	delete() {
		throw new Error('Not implemented');
	}
	
}

class UserFileAPI {
	
	constructor(user_id, path) {
		this.user_id = user_id;
		this.path = path;
	}
	
	get() {
		throw new Error('Not implemented');
	}
	
	replace(file) {
		throw new Error('Not implemented');
	}
	
	delete() {
		throw new Error('Not implemented');
	}
	
}

class JobAPI {
	
	constructor(job_id) {
		this.job_id = job_id;
	}
	
	modify(processGraph, output) {
		throw new Error('Not implemented');
	}
	
	get() {
		throw new Error('Not implemented');
	}
	
	subscribe() {
		throw new Error('Not implemented');
	}
	
	queue() {
		throw new Error('Not implemented');
	}
	
	pause() {
		throw new Error('Not implemented');
	}
	
	cancel() {
		throw new Error('Not implemented');
	}
	
}

class ServiceAPI {
	
	constructor(service_id) {
		this.service_id = service_id;
	}
	
	modify(job_id, service_type, service_args = {}) {
		throw new Error('Not implemented');
	}
	
	get() {
		throw new Error('Not implemented');
	}
	
	delete() {
		throw new Error('Not implemented');
	}
	
}

//// API ////
var OpenEO = {

	API: {

		// The URL of the server to query for information.
		baseUrl: 'http://localhost/api/v0',
		// The driver expected to respond on the server, e.g. 'openeo-sentinelhub-driver'.
		// Currently this is only to work around specific behaviour of backends
		// during development phase.
		driver: null,
	
		getCapabilities() {
			return OpenEO.HTTP.get('/capabilities');
		},
		
		getOutputFormats() {
			return OpenEO.HTTP.get('/capabilities/output_formats');
		}

	},
	
	HTTP: {

		get(path, query, responseType) {
			return this.send({
				method: 'get',
				responseType: responseType,
				url: path,
				params: query
			});
		},

		post(path, body, responseType) {
			var options = {
				method: 'post',
				responseType: responseType,
				url: path,
				data: body,
				headers: {}
			};
			return this.send(options);
		},

		send(options) {
			options.baseURL = OpenEO.API.baseUrl;
			if (OpenEO.Auth.isLoggedIn()) {
				options.withCredentials = true;
				if (!options.headers) {
					options.headers = {};
				}
				options.headers['Authorization'] = 'Bearer ' + OpenEO.Auth.token;
			}
			if (!options.responseType) {
				options.responseType = 'json';
			}

			// ToDo: Remove this, it's just for the R backend for now, might need to be extended
			if (OpenEO.API.driver === 'openeo-r-backend' && options.url.match(/^\/(processes|data|jobs|services|users(\/[^\/]+\/(files|process_graphs))?)$/)) {
				options.url += '/';
			}
			return axios(options)
				.then(data => data.data)
				.catch(data => data.status);
		}

	},

	ImageCollection: {

		create(collId) {
			return new ImageCollectionNode(collId);
		}

	},

	Auth: {

		userId: null,
		token: null,

		isLoggedIn() {
			return (this.token !== null);
		},

		login(username, password) {
			var options = {
				method: 'get',
				url: '/auth/login',
				withCredentials: true,
				auth: {
					username: username,
					password: password
				}
			};
			return OpenEO.HTTP.send(options).then(data => {
				this.userId = data.user_id;
				this.token = data.token;
				return data;
			}).catch(code => {
				if (code == 403) {
					this.userId = null;
					this.token = null;
				}
				return code;
			});
		},

		register(password) {
			var body = {
				password: password
			};
			return OpenEO.HTTP.post('/auth/register', body).then(data => {
				this.userId = data.user_id;
				return data;
			});
		}

	},

	Data: {

		DefaultQueryOptions: {
			qname: null,
			qgeom: null,
			qstartdate: null,
			qenddate: null
		},

		get(options) {
			var opts = options || this.DefaultQueryOptions;
			return OpenEO.HTTP.get('/data', opts);
		},

		getById(id) {
			return OpenEO.HTTP.get('/data/' + id);
		}

	},

	Processes: {

		get(name) {
			var query = {};
			if (name) {
				query.qname = name;
			}
			return OpenEO.HTTP.get('/processes', query);
		},

		getById(id) {
			return OpenEO.HTTP.get('/processes/' + id);
		}

	},
	
	UDFRuntimes: {
		
		get() {
			throw new Error('Not implemented');
		},
		
		getProcess(lang, udf_type) {
			throw new Error('Not implemented');
		}
		
	},

	Jobs: {

		create(processGraph, output) {
			return OpenEO.HTTP.post('/jobs', {
				process_graph: processGraph,
				output: output
			});
		},
		
		getObject(job_id) {
			return new JobAPI(job_id);
		}

	},
	
	Services: {
		
		create(job_id, service_type, service_args = {}) {
			throw new Error('Not implemented');
		},
		
		getCapabilities() {
			return OpenEO.HTTP.get('/capabilities/services');
		},
		
		getObject(service_id) {
			return new ServiceAPI(service_id);
		}
		
	},
	
	Users: {
		
		getObject(user_id) {
			return new UserAPI(user_id);
		}
		
	}

};

// ToDo: Export classes etc
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
	module.exports = OpenEO;
}
else {
	if (typeof define === 'function' && define.amd) {
		define([], function () {
			return OpenEO;
		});
	}
	else {
		window.OpenEO = OpenEO;
	}
}