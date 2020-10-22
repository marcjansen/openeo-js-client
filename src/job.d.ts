export = Job;
declare const Job_base: typeof import("./baseentity");
/**
 * A Batch Job.
 *
 * @augments BaseEntity
 */
declare class Job extends Job_base {
    /**
     * Creates an object representing a batch job stored at the back-end.
     *
     * @param {Connection} connection - A Connection object representing an established connection to an openEO back-end.
     * @param {string} jobId - The batch job ID.
     */
    constructor(connection: any, jobId: string);
    /**
     * The identifier of the batch job.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly id: string;
    /**
     * @public
     * @readonly
     * @type {?string}
     */
    public readonly title: string | null;
    /**
     * @public
     * @readonly
     * @type {?string}
     */
    public readonly description: string | null;
    /**
     * The process chain to be executed.
     * @public
     * @readonly
     * @type {object}
     */
    public readonly process: object;
    /**
     * The current status of a batch job.
     * One of "created", "queued", "running", "canceled", "finished" or "error".
     * @public
     * @readonly
     * @type {string}
     */
    public readonly status: string;
    /**
     * Indicates the process of a running batch job in percent.
     * @public
     * @readonly
     * @type {number}
     */
    public readonly progress: number;
    /**
     * Date and time of creation, formatted as a RFC 3339 date-time.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly created: string;
    /**
     * Date and time of the last status change, formatted as a RFC 3339 date-time.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly updated: string;
    /**
     * The billing plan to process and charge the batch job with.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly plan: string;
    /**
     * An amount of money or credits in the currency specified by the back-end.
     * @public
     * @readonly
     * @type {?number}
     */
    public readonly costs: number | null;
    /**
     * Maximum amount of costs the request is allowed to produce in the currency specified by the back-end.
     * @public
     * @readonly
     * @type {?number}
     */
    public readonly budget: number | null;
    /**
     * Updates the batch job data stored in this object by requesting the metadata from the back-end.
     *
     * @async
     * @returns {Promise<Job>} The update job object (this).
     * @throws {Error}
     */
    describeJob(): Promise<Job>;
    /**
     * Modifies the batch job at the back-end and afterwards updates this object, too.
     *
     * @async
     * @param {object} parameters - An object with properties to update, each of them is optional, but at least one of them must be specified. Additional properties can be set if the server supports them.
     * @param {object} parameters.process - A new process.
     * @param {string} parameters.title - A new title.
     * @param {string} parameters.description - A new description.
     * @param {string} parameters.plan - A new plan.
     * @param {number} parameters.budget - A new budget.
     * @returns {Promise<Job>} The updated job object (this).
     * @throws {Error}
     */
    updateJob(parameters: {
        process: object;
        title: string;
        description: string;
        plan: string;
        budget: number;
    }): Promise<Job>;
    /**
     * Deletes the batch job from the back-end.
     *
     * @async
     * @throws {Error}
     */
    deleteJob(): Promise<void>;
    /**
     * Calculate an estimate (potentially time/costs/volume) for a batch job.
     *
     * @async
     * @returns {Promise<object>} A response compatible to the API specification.
     * @throws {Error}
     */
    estimateJob(): Promise<object>;
    /**
     * Get logs for the batch job from the back-end.
     *
     * @returns {Logs}
     */
    debugJob(): import("./logs");
    /**
     * Checks for status changes and new log entries every x seconds.
     *
     * On every status change observed or on new log entries (if supported by the
     * back-end and not disabled via `requestLogs`), the callback is executed.
     * It may also be executed once at the beginning.
     * The callback receives the updated job (this object) and the logs (array) passed.
     *
     * The monitoring stops once the job has finished, was canceled or errored out.
     *
     * This is only supported if describeJob is supported by the back-end.
     *
     * Returns a function that can be called to stop monitoring the job manually.
     *
     * @param {Function} callback
     * @param {number} [interval=60] - Interval between update requests, in seconds as integer.
     * @param {boolean} [requestLogs=true] - Enables/Disables requesting logs
     * @returns {Function}
     * @throws {Error}
     */
    monitorJob(callback: Function, interval?: number, requestLogs?: boolean): Function;
    /**
     * Starts / queues the batch job for processing at the back-end.
     *
     * @async
     * @returns {Promise<Job>} The updated job object (this).
     * @throws {Error}
     */
    startJob(): Promise<Job>;
    /**
     * Stops / cancels the batch job processing at the back-end.
     *
     * @async
     * @returns {Promise<Job>} The updated job object (this).
     * @throws {Error}
     */
    stopJob(): Promise<Job>;
    /**
     * Retrieves the STAC Item produced for the job results.
     *
     * @async
     * @returns {Promise<object>} The JSON-based response compatible to the API specification, but also including a `costs` property if present in the headers.
     * @throws {Error}
     */
    getResultsAsItem(): Promise<object>;
    /**
     * Retrieves download links.
     *
     * @async
     * @returns {Promise<object>} A list of links (object with href, rel, title and type).
     * @throws {Error}
     */
    listResults(): Promise<object>;
    /**
     * Downloads the results to the specified target folder. The specified target folder must already exist!
     *
     * NOTE: This method is only supported in a NodeJS environment. In a browser environment this method throws an exception!
     *
     * @async
     * @param {string} targetFolder - A target folder to store the file to, which must already exist.
     * @returns {Promise<string[]|void>} Depending on the environment: A list of file paths of the newly created files (Node), throws in Browsers.
     * @throws {Error}
     */
    downloadResults(targetFolder: string): Promise<string[] | void>;
}