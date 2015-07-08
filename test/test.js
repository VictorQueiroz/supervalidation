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

		validator.defineRule('unique', function(value, attributeName, collection, colAttribute) {
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

	it('should include attribute in the validation definition', function () {
		var validator = new Validator({
			password: '3213213'
		}, {
			password: 'my-rule'
		});

		var hasAttributeName = false;
		validator.defineRule('my-rule', function (value, attributeName) {
			if(attributeName === 'password' && value === '3213213') {
				hasAttributeName = true;
			}
			return /(0+)/.test(value);
		});

		if(validator.fails()) {
			assert.ok(hasAttributeName);
		}
	});

	it('should validate complex objects', function () {
		var validator = new Validator({
		  name: 'John Doe',
		  address: {
				route: 'Street, 100'
			}
		},{
		  'address.route': 'string|required'
		});

		assert.ok(validator.passes());

		var validator = new Validator({
		  name: 'John Doe',
		  address: {
				route: 'Street, 100',
				streetNumber: 102
			}
		},{
		  'address.route': 'string|required',
		  'address.streetNumber': 'number|required'
		});
		assert.ok(validator.passes());

		var validator = new Validator({
		  a: {
		  	b: {
		  		c: {
		  			d: {
		  				e: {
		  					f: '_A_B_C@gmail.com'
		  				},
		  				e2: {
		  					f: {
		  						g1: {
		  							string: 'string'
		  						}
		  					}
		  				}
		  			}
		  		}
		  	}
		  }
		},{
		  'a.b.c.d.e.f': 'email|required',
		  'a.b.c.d.e2.f.g1.string': 'string|required'
		});
		assert.ok(validator.passes());

		var validator = new Validator({
		  name: 'John Doe',
		  address: {
				route: 'Street, 100',
				streetNumber: '102'
			}
		},{
		  'address.route': 'string|required',
		  'address.streetNumber': 'number|required'
		});

		validator.validate();

		assert.equal('The address.streetNumber must be a number.', validator.getMessages()['address.streetNumber']['number']);
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
	});

	it('should validate required fields', function () {
		var data = {
			email: 'myfakeemail@gmail.com',
			userId: 212
		};
		var validator = new Validator(data, {
			email: 'email|required',
			userId: 'number|required'
		});

		assert.ok(validator.passes());

		var data = {
			email: 'myfakeemail@gmail.com',
			userId: '212'
		};
		var validator = new Validator(data, {
			email: 'email|required',
			userId: 'number|required'
		});

		assert.equal(false, validator.passes());
	});

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
