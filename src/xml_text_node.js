function XMLTextNode(textNode, dataType, editor) {
	var textType = {
		text : true,
		type : dataType
	};

	this.textNode = textNode;
	this.xmlNode = $(textNode);
	
	AbstractXMLObject.call(this, editor, textType);
	
	// ID of the dom node for this element
	this.domNodeID = null;
	// dom node for this element
	this.domNode = null;
	// XMLElement which is the parent of this element
	this.parentElement = null;
	// Main input for text node of this element
	this.textInput = null;
	// dom element header for this element
	this.elementHeader = null;
	
}

XMLTextNode.prototype.constructor = XMLTextNode;
XMLTextNode.prototype = Object.create( AbstractXMLObject.prototype );

XMLTextNode.prototype.render = function(parentElement, relativeToXMLTextNode, prepend) {
	this.parentElement = parentElement;
	this.domNodeID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.domNode = document.createElement('div');
	var $domNode = $(this.domNode);
	this.domNode.id = this.domNodeID;
	this.domNode.className = xmlNodeClass + ' ' + xmlTextClass;
	
	this.parentElement.nodeContainer[0].appendChild(this.domNode);
	
	var textValue = "";
	if (!this.textNode) {
		this.textNode = document.createTextNode("");
		this.parentElement.xmlNode[0].appendChild(this.textNode);
		this.xmlNode = $(this.textNode);
	} else {
		textValue = this.textNode.nodeValue;
	}

	this.textInput = this.createElementInput(this.domNodeID + "_text", 
						textValue, this.domNode);
	this.textInput.addClass('element_text');

	this.deleteButton = document.createElement('span');
	this.deleteButton.className = 'xml_delete';
	this.deleteButton.appendChild(document.createTextNode('x'));
	this.domNode.appendChild(this.deleteButton);

	this.domNode = $domNode;
	this.domNode.data("xmlObject", this);
	
	return this.domNode;
};

// Persist the input value back into the text node
XMLTextNode.prototype.syncText = function() {
	this.textNode.nodeValue = this.textInput.val();
};

XMLTextNode.prototype.select = function() {
	
};