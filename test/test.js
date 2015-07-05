var Q = require('q');
var assert = require('assert');
var Validator = require('../src/supervalidator');

describe('Validator', function () {
	it('should validate fields', function () {
		var validator = new Validator({
			email: 'myfakeemail@gmail.com'
		}, {
			email: 'required|max:10'
		});
		var errorMessages = validator.validate().getMessages();

		assert.equal('The email may not be greater than 10 characters.', errorMessages.email.max);
	});
	it('should support deferred validations', function (done) {
		var validator = new Validator({
			email: 'myfakeemail@gmail.com'
		}, {
			email: 'required|max:10|unique:users,email'
		});
		validator.defineRule('unique', function(value, collection, colAttribute) {
			var deferred = Q.defer();
			setTimeout(function() {
				deferred.reject();
			}, 1000);
			return deferred.promise;
		});

		var errorMessages = validator.validate().then(function () {
			done();
		}).catch(function (err) {
			var errorMessages = err.getMessages();

			assert.equal('The email may not be greater than 10 characters.', errorMessages.email.max);
			assert.equal('The email has already been taken.', errorMessages.email.unique);

			done();
		});
	});
});