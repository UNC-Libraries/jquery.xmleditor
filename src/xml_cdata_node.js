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

XMLCDataNode.prototype.addXmlNode = function(relativeTo, prepend) {
	var textValue = "";
	if (!this.textNode) {
		var parentNode = this.parentElement.xmlNode[0];
		this.textNode = parentNode.ownerDocument.createCDATASection("");
		parentNode.appendChild(this.textNode);
		this.xmlNode = $(this.textNode);
	} else {
		textValue = this.textNode.nodeValue;
	}
	return textValue;
};

XMLCDataNode.prototype.render = function(parentElement, relativeToXMLTextNode, prepend) {
	XMLTextNode.prototype.render.call(this, parentElement, relativeToXMLTextNode, prepend);

	var header = document.createElement('div');
	header.className = 'xml_type_header';
	header.appendChild(document.createTextNode('CDATA'));

	this.domNode.children(".xml_input_column").prepend(header);
};

// Persist the input value back into the text node
XMLCDataNode.prototype.syncText = function() {
	XMLTextNode.prototype.syncText.call(this);
};

XMLCDataNode.prototype.remove = function() {
	AbstractXMLObject.prototype.remove.call(this);
};