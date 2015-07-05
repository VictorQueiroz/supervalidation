var path = require('path');

function Translator () {
	this.template = Translator.defaultTemplate;
}
Translator.setTemplatePath = function (templatePath) {
	Translator.defaultTemplate = templatePath;
};

Translator.prototype.getTemplate = function () {
	return require(this.template);
};

Translator.defaultTemplate = path.resolve(__dirname, './validation.template.js');

module.exports = Translator;