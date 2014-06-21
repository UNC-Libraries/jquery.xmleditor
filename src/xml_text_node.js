function XMLTextNode(textNode, dataType, editor) {
	var textType = {
		text : true,
		type : dataType
	};

	this.textNode = textNode;
	this.xmlNode = $(textNode);
	
	AbstractXMLObject.call(this, textType, editor);
	
}

XMLTextNode.prototype.constructor = XMLTextNode;
XMLTextNode.prototype = Object.create( AbstractXMLObject.prototype );

// Persist the input value back into the text node
XMLTextNode.prototype.syncText = function() {
	this.textNode.nodeValue = this.textInput.val();
};

XMLTextNode.prototype.select = function() {
	
};

XMLTextNode.prototype.addXmlNode = function(relativeTo, prepend) {
	var textValue = "";
	if (!this.textNode) {
		this.textNode = document.createTextNode("");
		this.parentElement.xmlNode[0].appendChild(this.textNode);
		this.xmlNode = $(this.textNode);
	} else {
		textValue = this.textNode.nodeValue;
	}
	return textValue;
};

XMLTextNode.prototype.render = function(parentElement, relativeTo, prepend) {
	this.parentElement = parentElement;
	this.domNodeID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.domNode = document.createElement('div');
	var $domNode = $(this.domNode);
	this.domNode.id = this.domNodeID;
	this.domNode.className = xmlNodeClass + ' ' + xmlTextClass;
	
	this.parentElement.nodeContainer[0].appendChild(this.domNode);

	var inputColumn = document.createElement('div');
	inputColumn.className = 'xml_input_column';
	this.domNode.appendChild(inputColumn);

	var textValue = this.addXmlNode(relativeTo, prepend);

	this.textInput = AbstractXMLObject.prototype.createElementInput.call(this,
			this.domNodeID + "_text", textValue, inputColumn);
	this.textInput.addClass('element_text');

	this.deleteButton = document.createElement('div');
	this.deleteButton.className = 'xml_delete';
	this.deleteButton.appendChild(document.createTextNode('x'));
	this.domNode.appendChild(this.deleteButton);

	this.domNode = $domNode;
	this.domNode.data("xmlObject", this);
	
	return this.domNode;
};

