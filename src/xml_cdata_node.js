function XMLCDataNode(cdataNode, editor) {
	var nodeType = {
		cdata : true,
		type : "cdata"
	};

	XMLTextNode.call(this, cdataNode, nodeType, editor);

	this.objectType = nodeType;
}

XMLCDataNode.prototype.constructor = XMLCDataNode;
XMLCDataNode.prototype = Object.create( XMLTextNode.prototype );

XMLCDataNode.prototype.addXmlNode = function(prepend) {
	var textValue = "";
	if (!this.textNode) {
		var parentNode = this.parentElement.xmlNode;
		this.textNode = parentNode[0].ownerDocument.createCDATASection("");
		if (prepend) {
			parentNode.prepend(this.textNode);
		} else {
			parentNode[0].appendChild(this.textNode);
		}
		this.xmlNode = $(this.textNode);
	} else {
		textValue = this.textNode.nodeValue;
	}
	return textValue;
};

XMLCDataNode.prototype.render = function(parentElement, prepend) {
	XMLTextNode.prototype.render.call(this, parentElement, prepend);
	this.domNode.addClass("xml_cdata_node");

	var header = document.createElement('label');
	header.className = 'xml_type_header';
	header.appendChild(document.createTextNode('CDATA'));
	$(header).attr("for", this.domNodeID + "_text");

	this.domNode.children(".xml_input_column").prepend(header);
};

// Persist the input value back into the text node
XMLCDataNode.prototype.syncText = function() {
	XMLTextNode.prototype.syncText.call(this);
};

XMLCDataNode.prototype.remove = function() {
	AbstractXMLObject.prototype.remove.call(this);
};

XMLCDataNode.prototype.select = function() {
	XMLTextNode.prototype.select.call(this);
};

XMLCDataNode.prototype.swap = function(swapTarget) {
	AbstractXMLObject.prototype.swap.call(this, swapTarget);
};

XMLCDataNode.prototype.moveUp = function() {
	AbstractXMLObject.prototype.moveUp.call(this);
};

XMLCDataNode.prototype.moveDown = function() {
	AbstractXMLObject.prototype.moveDown.call(this);
};

XMLCDataNode.prototype.focus = function() {
	AbstractXMLObject.prototype.focus.call(this);
};

XMLCDataNode.prototype.isSelected = function() {
	return AbstractXMLObject.prototype.isSelected.call(this);
};