# supervalidation

Easy validation for your forms. Based on Laravel 3.x validation module

## Installation
```
npm install --save supervalidation
```

## Usage

The response could or could not be a promise. If you provide only synchronous methods (which be default all rule definitions is), there will be no promise at the end, but if you do, you will totally need to deal with a promise.

### Example 1
```js
var validator = new Validator({
	name: 'Victor Queiroz',
	email: 'youremail@domain.com'
}, {
	email: 'string|required|email'
});
```

### Example 2
```js
var Q = require('q');

/* There is no limit for parameters in your rule definition */

Validator.defineRule('unique', function (
	value /* Value typed in the field by the user */,
	collection /* Param 1 */,
	attribute /* Param 2 */
) {
	var col = db.collection(collection);

	var deferred = Q.defer();

	col.findOne({
		email: value
	}, function (doc) {
		if(doc) {
			deferred.reject();
		} else {
			deferred.resolve();
		}
	});

	return deferred.promise;
});
```

*controller.js*

```js
module.exports = {
	registerUser: function (req, res) {
		var validator = new Validator(req.body, {
			email: 'required|unique:users,email'
		}, {
			templatePath: 'my-custom-language-variables.js'
		});
		validator.validate().then(function () {
			// THE VALIDATION HAS NO ERRORS! :)

			db.collection('users').insertOne(req.body).then(function(user) {
				res.json(user);
			});
		}, function (err) {
			res.json(err.getMessages());
		});
	}
};
```

When you fire `err.getMessages()` it will return a bunch of messages which by default are in english, but you can change at any time your template.

## Changing your language variables

All the messages are consumed from a file, which by default are [this](https://github.com/VictorQueiroz/supervalidation/blob/master/src/validation.template.js). It just return a big object (just like Grunt), which symbolizes each RULE that is defined.

```
module.exports = {
	min: {
		numeric: 'The :attribute must be at least :min.',
		file: 'The :attribute must be at least :min kilobytes.',
		string: 'The :attribute must be at least :min characters.',
		array: 'The :attribute must have at least :min items.',
	},
}
```

If the rule is an object and not a string, it will make a check through the type of the value typed in the field, and match with the right one. And this can be used with any rule.

`:attribute` will always be replaced by the name of the attribute, and `:min` in this case will be replaced by the first argument of the rule usage, and you can use this for any rule (expect for those who has no parameters, like `required`)

```
module.exports = {
	myCustomRule: 'The :attribute must have at least :myCustomRule items.'
}
```

## Changing your language variables template 

### Example 1 (Globally)
```
var path = require('path');
var Translator = require('supervalidator/translator');
Translator.setTemplatePath(path.resolve(__dirname, 'app/lang/en/validation.js'));
```

### Example 2 (Privately)
```
var validator = new Validator(req.body, {
	email: 'required|unique:users,email'
}, {
	templatePath: 'my-custom-language-variables.js'
});
```

## Predefined rule definitions
- required
- max:length
- min:length
- string

(Soon more)