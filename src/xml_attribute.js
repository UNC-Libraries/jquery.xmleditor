/**
 * Stores data representing a single attribute for an element
 */
function XMLAttribute(objectType, xmlElement, editor) {
	AbstractXMLObject.call(this, editor, objectType);
	this.xmlElement = xmlElement;
	this.attributeID = null;
	this.attributeInput = null;
	this.attributeContainer = null;
	this.addButton = null;

	var prefix;
	this.attributeName = objectType.localName;
	if (this.xmlElement.objectType.namespace != this.objectType.namespace) {
		prefix = this.editor.xmlState.namespaces.getNamespacePrefix(this.objectType.namespace);
		this.attributeName = prefix + this.attributeName;
	}
}

XMLAttribute.prototype.constructor = XMLAttribute;
XMLAttribute.prototype = Object.create( AbstractXMLObject.prototype );

XMLAttribute.prototype.getDomElement = function () {
	return this.attributeContainer;
};

XMLAttribute.prototype.render = function (){
	this.attributeID = this.xmlElement.guiElementID + "_" + this.objectType.name.replace(":", "_");
	
	this.attributeContainer = $("<div/>").attr({
		'id' : this.attributeID + "_cont",
		'class' : attributeContainerClass
	}).data('xmlAttribute', this).appendTo(this.xmlElement.getAttributeContainer());
	
	var self = this;
	var removeButton = document.createElement('a');
	removeButton.appendChild(document.createTextNode('(x) '));
	this.attributeContainer[0].appendChild(removeButton);
	
	var label = document.createElement('label');
	label.appendChild(document.createTextNode(this.objectType.name));
	this.attributeContainer[0].appendChild(label);
	
	var attributeValue = this.xmlElement.xmlNode.attr(this.attributeName);
	if (attributeValue == '' && this.objectType.defaultValue != null) {
		attributeValue = this.objectType.defaultValue;
	}
	
	this.attributeInput = this.createElementInput(this.attributeID.replace(":", "-"), attributeValue, this.attributeContainer[0]);
	this.attributeInput.data('xmlAttribute', this);
	
	return this.attributeInput;
};

XMLAttribute.prototype.remove = function() {
	if ($("#" + this.attributeID).length > 0) {
		if (this.addButton != null){
			this.addButton.removeClass("disabled");
		}
	}
	this.xmlElement.removeAttribute(this.objectType);
	this.attributeContainer.remove();
};

XMLAttribute.prototype.syncValue = function() {
	this.xmlElement.xmlNode.attr(this.attributeName, this.attributeInput.val());
};

XMLAttribute.prototype.changeValue = function(value) {
	this.xmlElement.xmlNode.attr(this.attributeName, value);
};

XMLAttribute.prototype.select = function() {
	this.editor.guiEditor.selectElement(self.xmlElement);
	this.attributeContainer.addClass('selected');
};

XMLAttribute.prototype.deselect = function() {
	this.attributeContainer.removeClass('selected');
};
