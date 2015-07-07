var Q = require('q');
var _ = require('lodash');

var Translator = require('./translator');

var map = _.map,
		every = _.every,
		clone = _.clone,
		first = _.first,
		extend = _.extend,
		filter = _.filter,
		forEach = _.forEach,
		isEmpty = _.isEmpty,
		isNumber = _.isNumber,
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
	this.definitions = clone(Validator.definitions);
	this.splittedRules = {};
	this._validating = false;

	extend(this, options);
}

function defineRule(ruleName, fn) {
	this.definitions[ruleName] = fn;
}

var URL_REGEXP = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;
var EMAIL_REGEXP = /^[a-z0-9!#$%&'*+\/=?^_`{|}~.-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

Validator.definitions = {
	string: function(value) {
		return isString(value);
	},
	required: function(value) {
		return isNumber(value) || !isEmpty(value);
	},
	url: function(value) {
		return URL_REGEXP.test(value);
	},
	email: function(value) {
		return EMAIL_REGEXP.test(value);
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

	validating: function() {
		return this._validating;
	},

	validated: function () {
		return this._validated;
	},
	
	passes: function () {
		if(!this.validating() && this.hasNoPromise() && !this.validated()) {
			this.validate();
		}

		var allTrue = every(this.validations, function(validation) {
			var isTrue = first(map(validation, function(value, key) {
				return value.value === true;
			}));
			return isTrue;
		});
		return allTrue;
	},

	fails: function() {
		return !this.passes();
	},

	hasNoPromise: function() {
		return every(this.validations, function(validation) {
			return first(map(validation, function (value) {
				return !isPromise(value.value);
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
	getResponse: function(responseType) {
		var response;

		switch(responseType) {
			default:
			case 'resolved':
				response = this.getResolvedResponse();
				break;
			case 'rejected':
				response = this.getRejectedResponse();
				break;
		}

		return response;
	},
	getResolvedResponse: function() {
		return this;
	},
	getRejectedResponse: function () {
		return this;
	},
	getMessages: function () {
		var template = (this.templatePath ? require(this.templatePath) : this.translator) || new ValidatorTranslator();
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
							msg = msg.number;
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

				messages[value.key][key] = msg.replace(/(\:attribute)/g, value.key);
			}));
		});

		return messages;
	},
	validate: function() {
		var self = this;

		this.splitRules();
		this._validating = true;

		var validations = this.validations = flattenDeep(map(this.splittedRules, function(rules, key) {
			var attributeValue = self.data[key];

			return map(rules, function(rule) {
				var validation = {
				};

				if(isString(rule)) {
					validation[rule] = {
						value: self.definitions[rule](attributeValue),
						attributeValue: attributeValue,
						key: key
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
			this._validating = false;
			this._validated = true;
			this.errors = this.filterValidations(false);

			if(this.passes()) {
				return this.getResponse('resolved');
			} else {
				return this.getResponse('rejected');
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
				self._validating = false;
				self._validated = true;
				self.errors = self.filterValidations(false);

				if(self.passes()) {
					deferred.resolve(self.getResponse('resolved'));
				} else {
					deferred.reject(self.getResponse('rejected'));
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