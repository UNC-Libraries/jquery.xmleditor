function XMLCommentNode(cdataNode, editor) {
	var nodeType = {
		comment : true,
		type : "comment"
	};

	XMLTextNode.call(this, cdataNode, nodeType, editor);

	this.objectType = nodeType;
}

XMLCommentNode.prototype.constructor = XMLCommentNode;
XMLCommentNode.prototype = Object.create( XMLTextNode.prototype );

XMLCommentNode.prototype.addXmlNode = function(prepend) {
	var textValue = "";
	if (!this.textNode) {
		var parentNode = this.parentElement.xmlNode;
		this.textNode = parentNode[0].ownerDocument.createComment("");
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

XMLCommentNode.prototype.render = function(parentElement, prepend) {
	XMLTextNode.prototype.render.call(this, parentElement, prepend);
	this.domNode.addClass("xml_comment_node");

	var header = document.createElement('label');
	header.className = 'xml_type_header';
	header.appendChild(document.createTextNode('comment'));
	$(header).attr("for", this.domNodeID + "_text");

	this.domNode.children(".xml_input_column").prepend(header);
};

// Persist the input value back into the text node
XMLCommentNode.prototype.syncText = function() {
	XMLTextNode.prototype.syncText.call(this);
};

XMLCommentNode.prototype.remove = function() {
	AbstractXMLObject.prototype.remove.call(this);
};

XMLCommentNode.prototype.select = function() {
	XMLTextNode.prototype.select.call(this);
};

XMLCommentNode.prototype.swap = function(swapTarget) {
	AbstractXMLObject.prototype.swap.call(this, swapTarget);
};

XMLCommentNode.prototype.moveUp = function() {
	AbstractXMLObject.prototype.moveUp.call(this);
};

XMLCommentNode.prototype.moveDown = function() {
	AbstractXMLObject.prototype.moveDown.call(this);
};