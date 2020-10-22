const TapDigit = require("./tapdigit");
const Parameter = require("./parameter");
const BuilderNode = require('./node');
const Builder = require('./builder'); // eslint-disable-line no-unused-vars

/**
 * This converts a mathematical formula into a openEO process for you.
 * 
 * Operators: - (subtract), + (add), / (divide), * (multiply), ^ (power)
 * 
 * It supports all mathematical functions (i.e. expects a number and returns a number) the back-end implements, e.g. `sqrt(x)`.
 * 
 * Only available if a builder is specified in the constructor:
 * You can refer to output from processes with a leading `#`, e.g. `#loadco1` if the node to refer to has the key `loadco1`.
 * 
 * Only available if a parent node is set via `setNode()`:
 * Parameters can be accessed simply by name. 
 * If the first parameter is a (labeled) array, the value for a specific index or label can be accessed by typing the numeric index or textual label with a $ in front, for example $B1 for the label B1 or $0 for the first element in the array. Numeric labels are not supported.
 * 
 * An example that computes an EVI (assuming the labels for the bands are `NIR`, `RED` and `BLUE`): `2.5 * ($NIR - $RED) / (1 + $NIR + 6 * $RED + (-7.5 * $BLUE))`
 */
class Formula {

	/**
	 * Creates a math formula object.
	 * 
	 * @param {string} formula - A mathematical formula to parse.y
	 */
	constructor(formula) {
		let parser = new TapDigit.Parser();
		/**
		 * @type {object}
		 */
		this.tree = parser.parse(formula);
		/**
		 * @type {?Builder}
		 */
		this.builder = null;
	}

	/**
	 * The builder instance to use.
	 * 
	 * @param {Builder} builder - The builder instance to add the formula to.
	 */
	setBuilder(builder) {
		this.builder = builder;
	}

	/**
	 * Generates the processes for the formula specified in the constructor.
	 * 
	 * Returns the last node that computes the result.
	 * 
	 * @param {boolean} setResultNode - Set the `result` flag to `true`.
	 * @returns {BuilderNode}
	 * @throws {Error}
	 */
	generate(setResultNode = true) {
		let finalNode = this.parseTree(this.tree);
		if (!(finalNode instanceof BuilderNode)) {
			throw new Error('Invalid formula specified.');
		}
		// Set result node
		if (setResultNode) {
			finalNode.result = true;
		}
		return finalNode;
	}

	/**
	 * Walks through the tree generated by the TapDigit parser and generates process nodes.
	 * 
	 * @protected
	 * @param {object} tree 
	 * @returns {object}
	 * @throws {Error}
	 */
	parseTree(tree) {
		let key = Object.keys(tree)[0]; // There's never more than one property so no loop required
		switch(key) {
			case 'Number':
				return parseFloat(tree.Number);
			case 'Identifier':
				return this.getRef(tree.Identifier);
			case 'Expression':
				return this.parseTree(tree.Expression);
			case 'FunctionCall': {
				let args = [];
				for(let i in tree.FunctionCall.args) {
					args.push(this.parseTree(tree.FunctionCall.args[i]));
				}
				return this.builder.process(tree.FunctionCall.name, args);
			}
			case 'Binary':
				return this.addOperatorProcess(
					tree.Binary.operator,
					this.parseTree(tree.Binary.left),
					this.parseTree(tree.Binary.right)
				);
			case 'Unary': {
				let val = this.parseTree(tree.Unary.expression);
				if (tree.Unary.operator === '-') {
					if (typeof val === 'number') {
						return -val;
					}
					else {
						return this.addOperatorProcess('*', -1, val);
					}
				}
				else {
					return val;
				}
			}
			default:
				throw new Error('Operation ' + key + ' not supported.');
		}
	}

	/**
	 * Gets the reference for a value, e.g. from_node or from_parameter.
	 * 
	 * @protected
	 * @param {*} value 
	 * @returns {*}
	 */
	getRef(value) {
		// Convert native data types
		if (value === 'true') {
			return true;
		}
		else if (value === 'false') {
			return false;
		}
		else if (value === 'null') {
			return null;
		}

		// Output of a process
		if (typeof value === 'string' && value.startsWith('#')) {
			let nodeId = value.substring(1);
			if (nodeId in this.builder.nodes) {
				return { from_node: nodeId };
			}
		}

		let callbackParams = this.builder.getParentCallbackParameters();
		// Array labels / indices
		if (typeof value === 'string' && value.startsWith('$') && callbackParams.length > 0) {
			let ref = value.substring(1);
			// Array access always refers to the first parameter passed
			return callbackParams[0][ref];
		}
		// Everything else is a parameter
		else {
			let parameter = new Parameter(value);
			// Add new parameter if it doesn't exist
			this.builder.addParameter(parameter);
			return parameter;
		}
	}

	/**
	 * Adds a process node for an operator like +, -, *, / etc.
	 * 
	 * @param {string} operator - The operator.
	 * @param {number|object} left - The left part for the operator.
	 * @param {number|object} right - The right part for the operator.
	 * @returns {BuilderNode}
	 * @throws {Error}
	 */
	addOperatorProcess(operator, left, right) {
		let processName = Formula.operatorMapping[operator];
		let process = this.builder.spec(processName);
		if (processName && process) {
			let args = {};
			if (!Array.isArray(process.parameters) || process.parameters.length < 2) {
				throw new Error("Process for operator " + operator + " must have at least two parameters");
			}
			args[process.parameters[0].name || 'x'] = left;
			args[process.parameters[1].name || 'y'] = right;
			return this.builder.process(processName, args);
		}
		else {
			throw new Error('Operator ' + operator + ' not supported');
		}
	}

}

/**
 * List of supported operators.
 * 
 * All operators must have the parameters be name x and y.
 * 
 * The key is the mathematical operator, the value is the process identifier.
 * 
 * @type {object<string, string>}
 */
Formula.operatorMapping = {
	"-": "subtract",
	"+": "add",
	"/": "divide",
	"*": "multiply",
	"^": "power"
};

module.exports = Formula;