function XMLTextNode(textNode, dataType, editor, vocabulary) {
	var textType = {
		text : true,
		type : dataType
	};

	this.textNode = textNode;
	this.xmlNode = $(textNode);
	this.vocabulary = vocabulary;
	
	AbstractXMLObject.call(this, textType, editor);
	
}

XMLTextNode.prototype.constructor = XMLTextNode;
XMLTextNode.prototype = Object.create( AbstractXMLObject.prototype );

// Persist the input value back into the text node
XMLTextNode.prototype.syncText = function() {
	this.textNode.nodeValue = this.textInput.val();
};

XMLTextNode.prototype.select = function() {
	$(".selected").removeClass("selected");
	this.domNode.closest("." + xmlElementClass).addClass("selected");
	this.domNode.addClass("selected");

};

XMLTextNode.prototype.addXmlNode = function(prepend) {
	var textValue = "";
	if (!this.textNode) {
		this.textNode = document.createTextNode("");
		if (prepend) {
			this.parentElement.xmlNode.prepend(this.textNode);
		} else {
			this.parentElement.xmlNode[0].appendChild(this.textNode);
		}
		this.xmlNode = $(this.textNode);
	} else {
		textValue = this.textNode.nodeValue;
	}
	return textValue;
};

XMLTextNode.prototype.render = function(parentElement, prepend) {
	this.parentElement = parentElement;
	this.domNodeID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.domNode = document.createElement('div');
	var $domNode = $(this.domNode);
	this.domNode.id = this.domNodeID;
	this.domNode.className = xmlNodeClass + ' ' + xmlTextClass;
	
	if (prepend) {
		this.parentElement.nodeContainer.prepend(this.domNode);
	} else {
		this.parentElement.nodeContainer[0].appendChild(this.domNode);
	}

	var inputColumn = document.createElement('div');
	inputColumn.className = 'xml_input_column';
	this.domNode.appendChild(inputColumn);

	var textValue = this.addXmlNode(prepend);

	this.textInput = AbstractXMLObject.prototype.createElementInput.call(this,
			this.domNodeID + "_text", textValue, inputColumn);
	this.textInput.addClass('element_text');
	if (this.vocabulary && this.vocabulary.values) {
		this.textInput.autocomplete({
				source : this.vocabulary.values
			});
	}

	this.deleteButton = document.createElement('div');
	this.deleteButton.className = 'xml_delete';
	this.deleteButton.appendChild(document.createTextNode('x'));
	this.domNode.appendChild(this.deleteButton);

	this.domNode = $domNode;
	this.domNode.data("xmlObject", this);
	
	return this.domNode;
};

XMLTextNode.prototype.swap = function(swapTarget) {
	AbstractXMLObject.prototype.swap.call(this, swapTarget);
};

XMLTextNode.prototype.moveUp = function() {
	AbstractXMLObject.prototype.moveUp.call(this);
};

XMLTextNode.prototype.moveDown = function() {
	AbstractXMLObject.prototype.moveDown.call(this);
};

XMLTextNode.prototype.focus = function() {
	AbstractXMLObject.prototype.focus.call(this);
};

XMLTextNode.prototype.isSelected = function() {
	return AbstractXMLObject.prototype.isSelected.call(this);
};

