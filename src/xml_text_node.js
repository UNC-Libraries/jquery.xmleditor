function XMLTextNode(xmlNode, editor) {
	var textType = {
		text : true,
		type : "text"
	};
	
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

XMLTextNode.prototype.render = function(parentElement, recursive, relativeToXMLTextNode, prepend) {
	this.parentElement = parentElement;
	this.domNodeID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.domNode = document.createElement('div');
	var $domNode = $(this.domNode);
	this.domNode.id = this.domNodeID;
	this.domNode.className = this.parentElement.objectType.ns + "_" + this.parentElement.objectType.localName + 'TextNode ' + xmlElementClass;
	
	this.parentElement.childContainer[0].appendChild(this.domNode);
	
	// Begin building contents
	this.elementHeader = document.createElement('ul');
	this.elementHeader.className = 'element_header';
	this.domNode.appendChild(this.elementHeader);
	var elementNameContainer = document.createElement('li');
	elementNameContainer.className = 'element_name';
	this.elementHeader.appendChild(elementNameContainer);
	
	this.elementHeader.appendChild(this.addTopActions(this.domNodeID));
	
	this.domNode = $domNode;
	this.domNode.data("xmlText", this);
	
	//this.updated({action : 'render'});
	
	return this.domNode;
};

//Generate buttons for performing move and delete actions on this element
XMLTextNode.prototype.addTopActions = function () {
	var self = this;
	var topActionSpan = document.createElement('li');
	topActionSpan.className = 'top_actions';
	
	var toggleCollapse = document.createElement('span');
	toggleCollapse.className = 'toggle_collapse';
	toggleCollapse.id = this.guiElementID + '_toggle_collapse';
	toggleCollapse.appendChild(document.createTextNode('_'));
	topActionSpan.appendChild(toggleCollapse);
	
	var moveDown = document.createElement('span');
	moveDown.className = 'move_down';
	moveDown.id = this.domNodeID + '_down';
	moveDown.appendChild(document.createTextNode('\u2193'));
	topActionSpan.appendChild(moveDown);
	
	var moveUp = document.createElement('span');
	moveUp.className = 'move_up';
	moveUp.id = this.domNodeID + '_up';
	moveUp.appendChild(document.createTextNode('\u2191'));
	topActionSpan.appendChild(moveUp);
	
	var deleteButton = document.createElement('span');
	deleteButton.className = 'delete';
	deleteButton.id = this.domNodeID + '_del';
	deleteButton.appendChild(document.createTextNode('X'));
	topActionSpan.appendChild(deleteButton);
	
	return topActionSpan;
};

//Synchronize the text input for this element to a text node in the xml document
XMLTextNode.prototype.syncText = function() {
	var newText = this.textInput.val();
	if (this.xmlNode[0].childNodes.length > 0) {
		this.xmlNode[0].childNodes[0].nodeValue = newText;
	} else {
		this.xmlNode[0].appendChild(document.createTextNode(newText));
	}
};

//Remove this element from the xml document and editor
XMLTextNode.prototype.remove = function() {
	// Remove the element from the xml doc
	this.xmlNode.remove();
	
	if (this.domNode != null) {
		this.domNode.remove();
	}
};

// Swap the gui representation of this element to the location of swapTarget
XMLTextNode.prototype.swap = function (swapTarget) {
	if (swapTarget == null) {
		return;
	}
	
	// Swap the xml nodes
	swapTarget.xmlNode.detach().insertAfter(this.xmlNode);
	if (swapTarget.domNode != null && this.domNode != null) {
		// Swap the gui nodes
		swapTarget.domNode.detach().insertAfter(this.domNode);
	}
};

// Move this element up one location in the gui.  Returns true if the swap was able to happen
XMLTextNode.prototype.moveUp = function() {
	var previousSibling = this.domNode.prev("." + XMLTextNodeClass);
	if (previousSibling.length > 0) {
		this.swap(previousSibling.data("XMLTextNode"));
		return true;
	} else {
		return false;
	}
};

XMLTextNode.prototype.select = function() {
	this.domNode.addClass("selected");
};

XMLTextNode.prototype.isSelected = function() {
	return this.domNode.hasClass("selected");
};