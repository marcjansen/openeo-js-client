const Environment = require('./env');
const Utils = require('@openeo/js-commons/src/utils');
const axios = require('axios').default;

const AuthProvider = require('./authprovider');
const BasicProvider = require('./basicprovider');
const OidcProvider = require('./oidcprovider');

const Capabilities = require('./capabilities');
const FileTypes = require('./filetypes');
const UserFile = require('./userfile');
const Job = require('./job');
const UserProcess = require('./userprocess');
const Service = require('./service');

const Builder = require('./builder/builder');
const BuilderNode = require('./builder/node');

/**
 * A connection to a back-end.
 */
class Connection {

	/**
	 * Creates a new Connection.
	 * 
	 * @param {string} baseUrl - URL to the back-end
	 */
	constructor(baseUrl) {
		/**
		 * @type {string}
		 */
		this.baseUrl = Utils.normalizeUrl(baseUrl);
		/**
		 * @type {?Array.<AuthProvider>}
		 */
		this.authProviderList = null;
		/**
		 * @type {?AuthProvider}
		 */
		this.authProvider = null;
		/**
		 * @type {?Capabilities}
		 */
		this.capabilitiesObject = null;
		this.processes = null;
	}

	/**
	 * Initializes the connection by requesting the capabilities.
	 * 
	 * @async
	 * @returns {Promise<Capabilities>} Capabilities
	 */
	async init() {
		let response = await this._get('/');
		this.capabilitiesObject = new Capabilities(response.data);
		return this.capabilitiesObject;
	}

	/**
	 * Returns the URL of the back-end currently connected to.
	 * 
	 * @returns {string} The URL or the back-end.
	 */
	getBaseUrl() {
		return this.baseUrl;
	}

	/**
	 * Returns the capabilities of the back-end.
	 * 
	 * @returns {Capabilities} Capabilities
	 */
	capabilities() {
		return this.capabilitiesObject;
	}

	/**
	 * List the supported output file formats.
	 * 
	 * @async
	 * @returns {Promise<FileTypes>} A response compatible to the API specification.
	 * @throws {Error}
	 */
	async listFileTypes() {
		let response = await this._get('/file_formats');
		return new FileTypes(response.data);
	}

	/**
	 * List the supported secondary service types.
	 * 
	 * @async
	 * @returns {Promise<object.<string, ServiceType>>} A response compatible to the API specification.
	 * @throws {Error}
	 */
	async listServiceTypes() {
		let response = await this._get('/service_types');
		return response.data;
	}

	/**
	 * List the supported UDF runtimes.
	 * 
	 * @async
	 * @returns {Promise<object.<string, UdfRuntime>>} A response compatible to the API specification.
	 * @throws {Error}
	 */
	async listUdfRuntimes() {
		let response = await this._get('/udf_runtimes');
		return response.data;
	}

	/**
	 * List all collections available on the back-end.
	 * 
	 * @async
	 * @returns {Promise<Collections>} A response compatible to the API specification.
	 * @throws {Error}
	 */
	async listCollections() {
		let response = await this._get('/collections');
		return response.data;
	}

	/**
	 * Get further information about a single collection.
	 * 
	 * @async
	 * @param {string} collectionId - Collection ID to request further metadata for.
	 * @returns {Promise<Collection>} - A response compatible to the API specification.
	 * @throws {Error}
	 */
	async describeCollection(collectionId) {
		let response = await this._get('/collections/' + collectionId);
		return response.data;
	}

	/**
	 * List all processes available on the back-end.
	 * 
	 * Data is cached in memory.
	 * 
	 * @async
	 * @returns {Promise<Processes>} - A response compatible to the API specification.
	 * @throws {Error}
	 */
	async listProcesses() {
		if (this.processes === null) {
			let response = await this._get('/processes');
			this.processes = response.data;
		}
		return this.processes;
	}

	/**
	 * Get information about a single process.
	 * 
	 * @async
	 * @param {string} processId - Collection ID to request further metadata for.
	 * @returns {Promise<?Process>} - A single process as object, or `null` if none is found.
	 * @throws {Error}
	 * @see Connection#listProcesses
	 */
	async describeProcess(processId) {
		let response = await this.listProcesses();
		if (Array.isArray(response.processes)) {
			let processes = response.processes.filter(process => process.id === processId);
			if (processes.length > 0) {
				return processes[0];
			}
		}
		return null;
	}

	/**
	 * Returns an object to simply build user-defined processes.
	 * 
	 * @async
	 * @param {string} id - A name for the process.
	 * @returns {Promise<Builder>}
	 * @throws {Error}
	 * @see Connection#listProcesses
	 */
	async buildProcess(id) {
		let response = await this.listProcesses();
		return new Builder(response.processes, null, id);
	}

	/**
	 * List all authentication methods supported by the back-end.
	 * 
	 * @async
	 * @returns {Promise<Array.<AuthProvider>>} An array containing all supported AuthProviders (including all OIDC providers and HTTP Basic).
	 * @throws {Error}
	 * @see AuthProvider
	 */
	async listAuthProviders() {
		if (this.authProviderList !== null) {
			return this.authProviderList;
		}

		this.authProviderList = [];
		let cap = this.capabilities();

		// Add OIDC providers
		if (cap.hasFeature('authenticateOIDC')) {
			let res = await this._get('/credentials/oidc');
			let oidcFactory = this.getOidcProviderFactory();
			if (Utils.isObject(res.data) && Array.isArray(res.data.providers) && typeof oidcFactory === 'function') {
				for(let i in res.data.providers) {
					let obj = oidcFactory(res.data.providers[i]);
					if (obj instanceof AuthProvider) {
						this.authProviderList.push(obj);
					}
				}
			}
		}
		
		// Add Basic provider
		if (cap.hasFeature('authenticateBasic')) {
			this.authProviderList.push(new BasicProvider(this));
		}

		return this.authProviderList;
	}

	/**
	 * This function is meant to create the OIDC providers used for authentication.
	 * 
	 * The function gets passed a single argument that contains the
	 * provider information as provided by the API, e.g. having the properties
	 * `id`, `issuer`, `title` etc.
	 * 
	 * The function must return an instance of AuthProvider or any derived class.
	 * May return `null` if the instance can't be created.
	 *
	 * @callback oidcProviderFactoryFunction
	 * @param {object.<string, *>} providerInfo - The provider information as provided by the API, having the properties `id`, `issuer`, `title` etc.
	 * @returns {?AuthProvider}
	 */

	/**
	 * Sets a factory function that creates custom OpenID Connect provider instances.
	 * 
	 * You only need to call this if you have implemented a new AuthProvider based
	 * on the AuthProvider interface (or OIDCProvider class), e.g. to use a
	 * OIDC library other than oidc-client-js.
	 * 
	 * @param {?oidcProviderFactoryFunction} providerFactoryFunc
	 * @see AuthProvider
	 */
	setOidcProviderFactory(providerFactoryFunc) {
		this.oidcProviderFactory = providerFactoryFunc;
	}

	/**
	 * Get the OpenID Connect provider factory.
	 * 
	 * Returns `null` if OIDC is not supported by the client or an instance
	 * can't be created for whatever reason.
	 * 
	 * @returns {?oidcProviderFactoryFunction}
	 * @see AuthProvider
	 */
	getOidcProviderFactory() {
		if (typeof this.oidcProviderFactory === 'function') {
			return this.oidcProviderFactory;
		}
		else {
			if (OidcProvider.isSupported()) {
				return providerInfo => new OidcProvider(this, providerInfo);
			}
			else {
				return null;
			}
		}
	}

	/**
	 * Authenticates with username and password against a back-end supporting HTTP Basic Authentication.
	 * 
	 * DEPRECATED in favor of using `listAuthProviders` and `BasicProvider`.
	 * 
	 * @async
	 * @deprecated
	 * @param {string} username 
	 * @param {string} password 
	 * @see BasicProvider
	 * @see Connection#listAuthProviders
	 */
	async authenticateBasic(username, password) {
		let basic = new BasicProvider(this);
		await basic.login(username, password);
	}

	/**
	 * Returns whether the user is authenticated (logged in) at the back-end or not.
	 * 
	 * @returns {boolean} `true` if authenticated, `false` if not.
	 */
	isAuthenticated() {
		return (this.authProvider !== null);
	}

	/**
	 * Returns the AuthProvider.
	 * 
	 * @returns {?AuthProvider} 
	 */
	getAuthProvider() {
		return this.authProvider;
	}

	/**
	 * Sets the AuthProvider.
	 * 
	 * The provider must have a token set.
	 * 
	 * @param {AuthProvider} provider 
	 * @throws {Error}
	 */
	setAuthProvider(provider) {
		if (provider instanceof AuthProvider && provider.getToken() !== null) {
			this.authProvider = provider;
		}
		else {
			throw new Error("Invalid auth provider given or no token set.");
		}
	}

	/**
	 * Sets the authentication token for the connection.
	 * 
	 * This creates a new custom `AuthProvider` with the given details and returns it.
	 * After calling this function you can make requests against the API.
	 * 
	 * This is NOT recommended to use. Only use if you know what you are doing.
	 * It is recommended to authenticate through `listAuthProviders` or related functions.
	 * 
	 * @param {string} type - The authentication type, e.g. `basic` or `oidc`.
	 * @param {string} providerId - The provider identifier. For OIDC the `id` of the provider.
	 * @param {string} token - The actual access token as given by the authentication method during the login process.
	 * @returns {AuthProvider}
	 */
	setAuthToken(type, providerId, token) {
		this.authProvider = new AuthProvider(type, this, {
			id: providerId,
			title: "Custom",
			description: ""
		});
		this.authProvider.setToken(token);
		return this.authProvider;
	}

	/**
	 * Get information about the authenticated user.
	 * 
	 * Updates the User ID if available.
	 * 
	 * @async
	 * @returns {Promise<UserAccount>} A response compatible to the API specification.
	 * @throws {Error}
	 */
	async describeAccount() {
		let response = await this._get('/me');
		return response.data;
	}

	/**
	 * Lists all files from the user workspace. 
	 * 
	 * @async
	 * @returns {Promise<Array.<UserFile>>} A list of files.
	 * @throws {Error}
	 */
	async listFiles() {
		let response = await this._get('/files');
		return response.data.files.map(
			f => new UserFile(this, f.path).setAll(f)
		);
	}


	/**
	 * A callback that is executed on upload progress updates.
	 * 
	 * @callback uploadStatusCallback
	 * @param {number} percentCompleted - The percent (0-100) completed.
	 */

	/**
	 * Uploads a file to the user workspace.
	 * If a file with the name exists, overwrites it.
	 * 
	 * This method has different behaviour depending on the environment.
	 * In a nodeJS environment the source must be a path to a file as string.
	 * In a browser environment the source must be an object from a file upload form.
	 * 
	 * @async
	 * @param {*} source - The source, see method description for details.
	 * @param {?string} [targetPath=null] - The target path on the server, relative to the user workspace. Defaults to the file name of the source file.
	 * @param {?uploadStatusCallback} [statusCallback=null] - Optionally, a callback that is executed on upload progress updates.
	 * @returns {Promise<UserFile>}
	 * @throws {Error}
	 */
	async uploadFile(source, targetPath = null, statusCallback = null) {
		if (targetPath === null) {
			targetPath = Environment.fileNameForUpload(source);
		}
		let file = await this.getFile(targetPath);
		return await file.uploadFile(source, statusCallback);
	}

	/**
	 * Opens a (existing or non-existing) file without reading any information or creating a new file at the back-end. 
	 * 
	 * @async
	 * @param {string} path - Path to the file, relative to the user workspace.
	 * @returns {Promise<UserFile>} A file.
	 * @throws {Error}
	 */
	async getFile(path) {
		return new UserFile(this, path);
	}

	/**
	 * Takes a UserProcess, BuilderNode or a plain object containing process nodes
	 * and converts it to an API compliant object.
	 * 
	 * @param {UserProcess|BuilderNode|object.<string, *>} process - Process to be normalized.
	 * @param {object.<string, *>} additional - Additional properties to be merged with the resulting object.
	 * @returns {object.<string, *>}
	 * @protected
	 */
	_normalizeUserProcess(process, additional = {}) {
		if (process instanceof UserProcess) {
			process = process.toJSON();
		}
		else if (process instanceof BuilderNode) {
			process.result = true;
			process = process.parent.toJSON();
		}
		else if (Utils.isObject(process) && !Utils.isObject(process.process_graph)) {
			process = {
				process_graph: process
			};
		}
		return Object.assign({}, additional, {process: process});
	}

	/**
	 * Validates a user-defined process at the back-end.
	 * 
	 * @async
	 * @param {Process} process - User-defined process to validate.
	 * @returns {Promise<Array.<ApiError>>} errors - A list of API compatible error objects. A valid process returns an empty list.
	 * @throws {Error}
	 */
	async validateProcess(process) {
		let response = await this._post('/validation', this._normalizeUserProcess(process).process);
		if (Array.isArray(response.data.errors)) {
			return response.data.errors;
		}
		else {
			throw new Error("Invalid validation response received.");
		}
	}

	/**
	 * Lists all user-defined processes of the authenticated user.
	 * 
	 * @async
	 * @returns {Promise<Array.<UserProcess>>} A list of user-defined processes.
	 * @throws {Error}
	 */
	async listUserProcesses() {
		let response = await this._get('/process_graphs');
		return response.data.processes.map(
			pg => new UserProcess(this, pg.id).setAll(pg)
		);
	}

	/**
	 * Creates a new stored user-defined process at the back-end.
	 * 
	 * @async
	 * @param {string} id - Unique identifier for the process.
	 * @param {Process} process - A user-defined process.
	 * @returns {Promise<UserProcess>} The new user-defined process.
	 * @throws {Error}
	 */
	async setUserProcess(id, process) {
		let pg = new UserProcess(this, id);
		return await pg.replaceUserProcess(process);
	}

	/**
	 * Get all information about a user-defined process.
	 * 
	 * @async
	 * @param {string} id - Identifier of the user-defined process. 
	 * @returns {Promise<UserProcess>} The user-defined process.
	 * @throws {Error}
	 */
	async getUserProcess(id) {
		let pg = new UserProcess(this, id);
		return await pg.describeUserProcess();
	}

	/**
	 * Executes a process synchronously and returns the result as the response.
	 * 
	 * Please note that requests can take a very long time of several minutes or even hours.
	 * 
	 * @async
	 * @param {Process} process - A user-defined process.
	 * @param {?string} [plan=null] - The billing plan to use for this computation.
	 * @param {?number} [budget=null] - The maximum budget allowed to spend for this computation.
	 * @returns {Promise<SyncResult>} - An object with the data and some metadata.
	 */
	async computeResult(process, plan = null, budget = null) {
		let requestBody = this._normalizeUserProcess(
			process,
			{
				plan: plan,
				budget: budget
			}
		);
		let response = await this._post('/result', requestBody, Environment.getResponseType());
		let syncResult = {
			data: response.data,
			costs: null,
			type: null,
			logs: []
		};
		
		if (typeof response.headers['openeo-costs'] === 'number') {
			syncResult.costs = response.headers['openeo-costs'];
		}
		
		if (typeof response.headers['content-type'] === 'string') {
			syncResult.type = response.headers['content-type'];
		}

		let links = Array.isArray(response.headers.link) ? response.headers.link : [response.headers.link];
		for(let link of links) {
			if (typeof link !== 'string') {
				continue;
			}
			let logs = link.match(/^<([^>]+)>;\s?rel="monitor"/i);
			if (Array.isArray(logs) && logs.length > 1) {
				try {
					let logsResponse = await this._get(logs[1]);
					if (Utils.isObject(logsResponse.data) && Array.isArray(logsResponse.data.logs)) {
						syncResult.logs = logsResponse.data.logs;
					}
				} catch(error) {
					console.warn(error);
				}
			}
		}

		return syncResult;
	}

	/**
	 * Executes a process synchronously and downloads to result the given path.
	 * 
	 * Please note that requests can take a very long time of several minutes or even hours.
	 * 
	 * This method has different behaviour depending on the environment.
	 * If a NodeJs environment, writes the downloaded file to the target location on the file system.
	 * In a browser environment, offers the file for downloading using the specified name (folders are not supported).
	 * 
	 * @async
	 * @param {Process} process - A user-defined process.
	 * @param {string} targetPath - The target, see method description for details.
	 * @param {?string} [plan=null] - The billing plan to use for this computation.
	 * @param {?number} [budget=null] - The maximum budget allowed to spend for this computation.
	 * @throws {Error}
	 */
	async downloadResult(process, targetPath, plan = null, budget = null) {
		let response = await this.computeResult(process, plan, budget);
		// @ts-ignore
		await Environment.saveToFile(response.data, targetPath);
	}

	/**
	 * Lists all batch jobs of the authenticated user.
	 * 
	 * @async
	 * @returns {Promise<Array.<Job>>} A list of jobs.
	 * @throws {Error}
	 */
	async listJobs() {
		let response = await this._get('/jobs');
		return response.data.jobs.map(
			j => new Job(this, j.id).setAll(j)
		);
	}

	/**
	 * Creates a new batch job at the back-end.
	 * 
	 * @async
	 * @param {Process} process - A user-define process to execute.
	 * @param {?string} [title=null] - A title for the batch job.
	 * @param {?string} [description=null] - A description for the batch job.
	 * @param {?string} [plan=null] - The billing plan to use for this batch job.
	 * @param {?number} [budget=null] - The maximum budget allowed to spend for this batch job.
	 * @param {object.<string, *>} [additional={}] - Proprietary parameters to pass for the batch job.
	 * @returns {Promise<Job>} The stored batch job.
	 * @throws {Error}
	 */
	async createJob(process, title = null, description = null, plan = null, budget = null, additional = {}) {
		additional = Object.assign({}, additional, {
			title: title,
			description: description,
			plan: plan,
			budget: budget
		});
		let requestBody = this._normalizeUserProcess(process, additional);
		let response = await this._post('/jobs', requestBody);
		if (typeof response.headers['openeo-identifier'] !== 'string') {
			throw new Error("Response did not contain a Job ID. Job has likely been created, but may not show up yet.");
		}
		let job = new Job(this, response.headers['openeo-identifier']).setAll(requestBody);
		if (this.capabilitiesObject.hasFeature('describeJob')) {
			return await job.describeJob();
		}
		else {
			return job;
		}
	}

	/**
	 * Get all information about a batch job.
	 * 
	 * @async
	 * @param {string} id - Batch Job ID. 
	 * @returns {Promise<Job>} The batch job.
	 * @throws {Error}
	 */
	async getJob(id) {
		let job = new Job(this, id);
		return await job.describeJob();
	}

	/**
	 * Lists all secondary web services of the authenticated user.
	 * 
	 * @async
	 * @returns {Promise<Array.<Job>>} A list of services.
	 * @throws {Error}
	 */
	async listServices() {
		let response = await this._get('/services');
		return response.data.services.map(
			s => new Service(this, s.id).setAll(s)
		);
	}

	/**
	 * Creates a new secondary web service at the back-end. 
	 * 
	 * @async
	 * @param {Process} process - A user-defined process.
	 * @param {string} type - The type of service to be created (see `Connection.listServiceTypes()`).
	 * @param {?string} [title=null] - A title for the service.
	 * @param {?string} [description=null] - A description for the service.
	 * @param {boolean} [enabled=true] - Enable the service (`true`, default) or not (`false`).
	 * @param {object.<string, *>} [configuration={}] - Configuration parameters to pass to the service.
	 * @param {?string} [plan=null] - The billing plan to use for this service.
	 * @param {?number} [budget=null] - The maximum budget allowed to spend for this service.
	 * @param {object.<string, *>} [additional={}] - Proprietary parameters to pass for the batch job.
	 * @returns {Promise<Service>} The stored service.
	 * @throws {Error}
	 */
	async createService(process, type, title = null, description = null, enabled = true, configuration = {}, plan = null, budget = null, additional = {}) {
		let requestBody = this._normalizeUserProcess(process, Object.assign({
			title: title,
			description: description,
			type: type,
			enabled: enabled,
			configuration: configuration,
			plan: plan,
			budget: budget
		}, additional));
		let response = await this._post('/services', requestBody);
		if (typeof response.headers['openeo-identifier'] !== 'string') {
			throw new Error("Response did not contain a Service ID. Service has likely been created, but may not show up yet.");
		}
		let service = new Service(this, response.headers['openeo-identifier']).setAll(requestBody);
		if (this.capabilitiesObject.hasFeature('describeService')) {
			return service.describeService();
		}
		else {
			return service;
		}
	}

	/**
	 * Get all information about a secondary web service.
	 * 
	 * @async
	 * @param {string} id - Service ID. 
	 * @returns {Promise<Service>} The service.
	 * @throws {Error}
	 */
	async getService(id) {
		let service = new Service(this, id);
		return await service.describeService();
	}

	/**
	 * Sends a GET request.
	 * 
	 * @async
	 * @param {string} path 
	 * @param {object.<string, *>} query 
	 * @param {string} responseType - Response type according to axios, defaults to `json`.
	 * @returns {Promise<AxiosResponse>}
	 * @throws {Error}
	 * @see https://github.com/axios/axios#request-config
	 */
	async _get(path, query, responseType) {
		return await this._send({
			method: 'get',
			responseType: responseType,
			url: path,
			// Timeout for capabilities requests as they are used for a quick first discovery to check whether the server is a openEO back-end.
			// Without timeout connecting with a wrong server url may take forever.
			timeout: path === '/' ? 3000 : 0,
			params: query
		});
	}

	/**
	 * Sends a POST request.
	 * 
	 * @async
	 * @param {string} path 
	 * @param {*} body 
	 * @param {string} responseType - Response type according to axios, defaults to `json`.
	 * @returns {Promise<AxiosResponse>}
	 * @throws {Error}
	 * @see https://github.com/axios/axios#request-config
	 */
	async _post(path, body, responseType) {
		return await this._send({
			method: 'post',
			responseType: responseType,
			url: path,
			data: body
		});
	}

	/**
	 * Sends a PUT request.
	 * 
	 * @async
	 * @param {string} path 
	 * @param {*} body 
	 * @returns {Promise<AxiosResponse>}
	 * @throws {Error}
	 */
	async _put(path, body) {
		return await this._send({
			method: 'put',
			url: path,
			data: body
		});
	}

	/**
	 * Sends a PATCH request.
	 * 
	 * @async
	 * @param {string} path 
	 * @param {*} body 
	 * @returns {Promise<AxiosResponse>}
	 * @throws {Error}
	 */
	async _patch(path, body) {
		return await this._send({
			method: 'patch',
			url: path,
			data: body
		});
	}

	/**
	 * Sends a DELETE request.
	 * 
	 * @async
	 * @param {string} path 
	 * @returns {Promise<AxiosResponse>}
	 * @throws {Error}
	 */
	async _delete(path) {
		return await this._send({
			method: 'delete',
			url: path
		});
	}

	/**
	 * Downloads data from a URL.
	 * 
	 * May include authorization details where required.
	 * 
	 * @param {string} url - An absolute or relative URL to download data from.
	 * @param {boolean} authorize - Send authorization details (`true`) or not (`false`).
	 * @returns {Promise<Stream.Readable|Blob>} - Returns the data as `Stream` in NodeJS environments or as `Blob` in browsers
	 * @throws {Error}
	 */
	async download(url, authorize) {
		let result = await this._send({
			method: 'get',
			responseType: Environment.getResponseType(),
			url: url,
			authorization: authorize
		});
		return result.data;
	}

	/**
	 * Sends a HTTP request.
	 * 
	 * Options mostly conform to axios,
	 * see {@link https://github.com/axios/axios#request-config}.
	 * 
	 * Automatically sets a baseUrl and the authorization information.
	 * Default responseType is `json`.
	 * 
	 * Tries to smoothly handle error responses by providing an object for all response types,
	 * instead of Streams or Blobs for non-JSON response types.
	 * 
	 * @async
	 * @param {object.<string, *>} options 
	 * @returns {Promise<AxiosResponse>}
	 * @throws {Error}
	 * @see https://github.com/axios/axios
	 */
	async _send(options) {
		options.baseURL = this.baseUrl;
		if (this.isAuthenticated() && (typeof options.authorization === 'undefined' || options.authorization === true)) {
			if (!options.headers) {
				options.headers = {};
			}
			options.headers.Authorization = 'Bearer ' + this.authProvider.getToken();
		}
		if (!options.responseType) {
			options.responseType = 'json';
		}

		try {
			return await axios(options);
		} catch(error) {
			if (Utils.isObject(error.response) && Utils.isObject(error.response.data) && ((typeof error.response.data.type === 'string' && error.response.data.type.indexOf('/json') !== -1) || (Utils.isObject(error.response.data.headers) && typeof error.response.data.headers['content-type'] === 'string' && error.response.data.headers['content-type'].indexOf('/json') !== -1))) {
				if (options.responseType === Environment.getResponseType()) {
					// JSON error responses are Blobs and streams if responseType is set as such, so convert to JSON if required.
					// See: https://github.com/axios/axios/issues/815
					return Environment.handleErrorResponse(error);
				}
			}
			// Re-throw error if it was not handled yet.
			throw error;
		}
	}
}

module.exports = Connection;
