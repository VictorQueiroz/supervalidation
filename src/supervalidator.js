var Q = require('q');
var _ = require('lodash');

var Translator = require('./translator');

var map = _.map,
		every = _.every,
		first = _.first,
		extend = _.extend,
		filter = _.filter,
		forEach = _.forEach,
		isString = _.isString,
		isObject = _.isObject,
		isPromise = function (v) { return _.isFunction(v.then); },
		mapValues = _.mapValues,
		isFunction = _.isFunction,
		isUndefined = _.isUndefined,
		flattenDeep = _.flattenDeep;

function ValidatorTranslator() {
	this.translator = new Translator();
	return this.translator.getTemplate();
}

function Validator(data, rules, options) {
	this.rules = rules;
	this.data = data;
	this.definitions = Validator.definitions;
	this.splittedRules = {};

	_.extend(this, options);
}

function defineRule(ruleName, fn) {
	this.definitions[ruleName] = fn;
}

Validator.definitions = {
	string: function(value) {
		return _.isString(value);
	},
	required: function(value) {
		return !_.isUndefined(value);
	},
	max: function(value, maxValue) {
		return value.length <= maxValue;
	},
	min: function(value, minValue) {
		return value.length >= minValue;
	}
};
Validator.defineRule = defineRule;

Validator.prototype = {
	defineRule: defineRule,
	hasSucceed: function () {
		var allTrue = every(this.validations, function(validation) {
			var isTrue = first(map(validation, function(value, key) {
				return value === true;
			}));
			return isTrue;
		});
		return allTrue;
	},
	hasNoPromise: function() {
		return every(this.validations, function(p) {
			return first(map(p, function (v) {
				return !isPromise(v.value);
			}));
		});
	},
	filterValidations: function (desiredValue) {
		return filter(this.validations, function (validation) {
			return first(map(validation, function(value, key) {
				return value.value === desiredValue;
			}));
		});
	},
	getRejectedResponse: function () {
		var self = this,
				validations = this.validations;

		return {
			errors: this.filterValidations(false),
			validations: validations,
			succeed: this.hasSucceed(),
			getMessages: function() {
				var template = (self.templatePath ? require(self.templatePath) : self.translator) || new ValidatorTranslator();
				var messages = {};

				forEach(this.errors, function (validation) {
					first(map(validation, function (value, key) {
						var msg = template.hasOwnProperty(key) && template[key];

						if(isObject(msg)) {
							switch(typeof value.attributeValue) {
								default:
								case 'string':
									msg = msg.string;
									break;
								case 'number':
									msg = msg.numeric;
									break;
								case 'array':
									msg = msg.array;
									break;
							}
						} else if(isUndefined(msg)) {
							msg = '??';
						}

						var thisAttr = ':' + key;

						if(msg.indexOf(thisAttr) > -1){
							msg = msg.replace(new RegExp(thisAttr, 'g'), first(value.args));
						}

						if(isUndefined(messages[value.key])){
							messages[value.key] = {};
						}

						messages[value.key][key] = msg.replace(/(\:attribute)/g, value.key) || '??';
					}));
				});

				return messages;
			}
		};
	},
	validate: function() {
		var self = this;

		this.splitRules();

		var validations = this.validations = flattenDeep(map(this.splittedRules, function(rules, key) {
			var attributeValue = self.data[key];

			return map(rules, function(rule) {
				var validation = {
				};

				if(isString(rule)) {
					validation[rule] = {
						value: self.definitions[rule](attributeValue),
						attributeValue: attributeValue
					};

					return validation;
				} else if (isObject(rule)) {
					return map(rule, function(args, k) {
						validation[k] = {
							value: self.definitions[k].apply(self, [attributeValue].concat(args)),
							args: args,
							key: key,
							attributeValue: attributeValue
						};

						return validation;
					});
				}
			});
		}));

		if(this.hasNoPromise()) {
			if(this.hasSucceed()) {
				return validations;
			} else {
				return this.getRejectedResponse();
			}
		} else {
			var deferred = Q.defer();
			var promises = [];

			forEach(validations, function(validation, index) {
				map(validation, function (attrValue, attrKey) {
					if(isPromise(attrValue.value)) {
						promises.push(attrValue.value.then(function(realAttrValue) {
							validations[index][attrKey].value = (realAttrValue || true);
						}, function (err) {
							validations[index][attrKey].value = false;
						}));
					}
				});
			});

			Q.all(promises).then(function() {
				if(self.hasSucceed()) {
					deferred.resolve(validations);
				} else {
					deferred.reject(self.getRejectedResponse());
				}
			});

			return deferred.promise;
		}
	},
	splitRules: function() {
		extend(this.splittedRules, mapValues(this.rules, function(value) {
			return map(value.split('|'), function(value) {
				var match = value.split(':'),
						matchLength = match.length,
						args = [],
						obj = {};

				value = match[0];
				
				if(matchLength > 1) {
					args = args.concat(match[1].split(','));

					obj[value] = args;
					return obj;
				}

				return value;
			});
		}));

		return this.splittedRules;
	}
};

module.exports = Validator;