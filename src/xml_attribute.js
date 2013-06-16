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
}

XMLAttribute.prototype.constructor = XMLAttribute;
XMLAttribute.prototype = Object.create( AbstractXMLObject.prototype );

XMLAttribute.prototype.getDomElement = function () {
	return this.attributeContainer;
};

XMLAttribute.prototype.render = function (){
	this.attributeID = this.xmlElement.guiElementID + "_" + this.objectType.nameEsc;
	
	var elementNode = this.xmlElement.guiElement;
	
	this.attributeContainer = $("<div/>").attr({
		'id' : this.attributeID + "_cont",
		'class' : attributeContainerClass
	}).data('xmlAttribute', this).appendTo(elementNode.children("." + attributesContainerClass));
	
	var self = this;
	$("<a/>").html("(x) ").css("cursor", "pointer").on('click', function(event) {
		self.remove();
		event.stopPropagation();
	}).appendTo(this.attributeContainer);
	
	$('<label/>').text(this.objectType.name).appendTo(this.attributeContainer);
	
	var attributeValue = this.xmlElement.xmlNode.attr(this.objectType.name);
	if (attributeValue == '' && this.objectType.defaultValue != null) {
		attributeValue = this.objectType.defaultValue;
	}
	
	this.attributeInput = this.createElementInput(this.attributeID.replace(":", "-"), attributeValue, this.attributeContainer);
	
	this.attributeInput.data('xmlAttribute', this).change(function(){
		self.syncValue();
		self.editor.xmlState.documentChangedEvent();
	});
	
	this.attributeContainer.click(function(event) {
		self.editor.guiEditor.selectElement(self.xmlElement);
		event.stopPropagation();
		$(this).addClass('selected');
	});
	
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
	this.xmlElement.updated();
	this.editor.xmlState.documentChangedEvent();
};

XMLAttribute.prototype.syncValue = function() {
	this.xmlElement.xmlNode.attr(this.objectType.name, this.attributeInput.val());
};

XMLAttribute.prototype.changeValue = function(value) {
	this.xmlElement.xmlNode.attr(this.objectType.name, value);
};
