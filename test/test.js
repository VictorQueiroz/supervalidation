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
		}, function (err) {
			var errorMessages = err.getMessages();

			assert.equal('The email may not be greater than 10 characters.', errorMessages.email.max);
			assert.equal('The email has already been taken.', errorMessages.email.unique);

			done();
		});
	});

	it('should automatically validate synchronous validations with passes() or fails() method', function () {
		var validator = new Validator({
			email: 'myfakeemail@gmail.com'
		}, {
			email: 'email|required'
		});

		var valid = false;
		if(validator.passes()) {
			valid = true;
		}

		assert.ok(valid);

		var validator = new Validator({
			email: ''
		}, {
			email: 'required'
		});

		assert.equal(false, validator.passes());
	});
});

describe('Validation definitions', function () {
	it('should validate emails', function() {
		var data = {
			email: 'myfakeemail@gmail.com'
		};
		var validator = new Validator(data, {
			email: 'email|required'
		});

		assert.ok(validator.passes());

		var validator = new Validator({
			email: 'myfakeemail_gmail@'
		}, {
			email: 'email|required'
		});

		assert.ok(validator.fails());
		assert.equal('The email must be a valid email address.', validator.getMessages().email.email);
	})

	it('should validate urls', function() {
		var data = {
			email: 'myfakeemail@gmail.com',
			profileUrl: 'http://mywebsite.com'
		};
		var validator = new Validator(data, {
			email: 'email|required',
			profileUrl: 'url|required'
		});

		assert.ok(validator.passes());

		var validator = new Validator({
			email: 'myfakeemail_gmail@',
			profileUrl: 'mywebsite@qdqwd.com'
		}, {
			email: 'email|required',
			profileUrl: 'url|required'
		});

		assert.ok(validator.fails());

		var errorMsgs = validator.getMessages();
		
		assert.equal('The email must be a valid email address.', errorMsgs.email.email);
		assert.equal('The profileUrl format is invalid.', errorMsgs.profileUrl.url);

		var validator = new Validator({
			email: 'myfakeemail@gmail.com',
			profileUrl: 'http://mywebsite.qdqwd.com'
		}, {
			email: 'email|required',
			profileUrl: 'url|required'
		});

		assert.ok(validator.passes());
	})
});