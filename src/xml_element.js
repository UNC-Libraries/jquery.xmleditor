/**
 * Stores data related to a single xml element as it is represented in both the base XML 
 * document and GUI
 */
function XMLElement(xmlNode, objectType, editor) {
	AbstractXMLObject.call(this, editor, objectType);
	this.xmlNode = $(xmlNode);
	this.isTopLevel = this.xmlNode[0].parentNode.parentNode === this.xmlNode[0].ownerDocument;
	this.allowChildren = this.objectType.elements.length > 0;
	this.allowAttributes = this.objectType.attributes != null && this.objectType.attributes.length > 0;
	this.allowText = this.objectType.type != null;
	this.guiElementID = null;
	this.guiElement = null;
	this.parentElement = null;
	this.textInput = null;
	this.elementHeader = null;
	this.childContainer = null;
	this.childCount = 0;
	this.attributeContainer = null;
	this.attributeCount = 0;
}

XMLElement.prototype.constructor = XMLElement;
XMLElement.prototype = Object.create( AbstractXMLObject.prototype );

XMLElement.prototype.getDomElement = function () {
	return this.guiElement;
};

XMLElement.prototype.render = function(parentElement, recursive) {
	this.parentElement = parentElement;
	this.guiElementID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.guiElement = document.createElement('div');
	this.guiElement.id = this.guiElementID;
	this.guiElement.className = this.objectType.name.replace(":", "_") + 'Instance ' + xmlElementClass;
	if (this.isTopLevel)
		this.guiElement.className += ' ' + topLevelContainerClass;
	this.parentElement.childContainer[0].appendChild(this.guiElement);
	
	// Begin building contents
	this.elementHeader = document.createElement('ul');
	this.elementHeader.className = 'element_header';
	this.guiElement.appendChild(this.elementHeader);
	var elementNameContainer = document.createElement('li');
	elementNameContainer.className = 'element_name';
	this.elementHeader.appendChild(elementNameContainer);

	// set up element title and entry field if appropriate
	var titleElement = document.createElement('span');
	titleElement.appendChild(document.createTextNode(this.objectType.name));
	elementNameContainer.appendChild(titleElement);
	
	// Switch gui element over to a jquery object
	this.guiElement = $(this.guiElement);
	this.guiElement.data("xmlElement", this);

	// Add the subsections for the elements content next.
	this.addContentContainers(recursive);

	// Action buttons
	this.elementHeader.appendChild(this.addTopActions(this.guiElementID));
	
	var self = this;
	
	this.initializeGUI();
	this.updated({action : 'render'});
	
	return this.guiElement;
};

XMLElement.prototype.renderChildren = function(recursive) {
	this.childCount = 0;
	this.guiElement.children("." + xmlElementClass).remove();
	
	var elementsArray = this.objectType.elements;
	var self = this;
	this.xmlNode.children().each(function() {
		for ( var i = 0; i < elementsArray.length; i++) {
			if (self.editor.nsEquals(this, elementsArray[i])) {
				var childElement = new XMLElement($(this), elementsArray[i], self.editor);
				childElement.render(self, recursive);
				return;
			}
		}
	});
};

XMLElement.prototype.renderAttributes = function () {
	var self = this;
	var attributesArray = this.objectType.attributes;
	
	$(this.xmlNode[0].attributes).each(function() {
		var attrNamespace = this.namespaceURI? this.namespaceURI : self.objectType.namespace;
		var attrLocalName = self.editor.stripPrefix(this.nodeName);
		for ( var i = 0; i < attributesArray.length; i++) {
			if (attributesArray[i].localName == attrLocalName && attributesArray[i].namespace == attrNamespace) {
				var attribute = new XMLAttribute(attributesArray[i], self, self.editor);
				attribute.render();
				return;
			}
		}
	});
};

XMLElement.prototype.initializeGUI = function () {
	var self = this;
	if (this.childContainer != null) {
		this.childContainer.sortable({
			distance: 10,
			items: '> .' + xmlElementClass,
			update: function(event, ui) {
				self.editor.guiEditor.updateElementPosition($(ui.item));
			}
		});
	}
};

XMLElement.prototype.addTopActions = function () {
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
	moveDown.id = this.guiElementID + '_down';
	moveDown.appendChild(document.createTextNode('\u2193'));
	topActionSpan.appendChild(moveDown);
	
	var moveUp = document.createElement('span');
	moveUp.className = 'move_up';
	moveUp.id = this.guiElementID + '_up';
	moveUp.appendChild(document.createTextNode('\u2191'));
	topActionSpan.appendChild(moveUp);
	
	var deleteButton = document.createElement('span');
	deleteButton.className = 'delete';
	deleteButton.id = this.guiElementID + '_del';
	deleteButton.appendChild(document.createTextNode('X'));
	topActionSpan.appendChild(deleteButton);
	
	return topActionSpan;
};

XMLElement.prototype.addContentContainers = function (recursive) {
	var attributesArray = this.objectType.attributes;
	var elementsArray = this.objectType.elements;
	
	var placeholder = document.createElement('div');
	placeholder.className = 'placeholder';
	if (attributesArray.length > 0){
		if (elementsArray.length > 0)
			placeholder.appendChild(document.createTextNode('Use the menu to add subelements and attributes.'));
		else
			placeholder.appendChild(document.createTextNode('Use the menu to add attributes.'));
	} else
		placeholder.appendChild(document.createTextNode('Use the menu to add subelements.'));
	this.placeholder = $(placeholder);
	this.guiElement.append(this.placeholder);
	
	if (attributesArray.length > 0) {
		this.addAttributeContainer();
	}
	
	if (this.objectType.type != null) {
		this.addTextContainer();
	}

	if (elementsArray.length > 0) {
		this.addSubelementContainer(recursive);
	}
};

XMLElement.prototype.addTextContainer = function () {
	var container = document.createElement('div');
	container.id = this.guiElementID + "_cont_text";
	container.className = 'content_block';
	this.guiElement.append(container);
	var textContainsChildren = this.xmlNode[0].children && this.xmlNode[0].children.length > 0;
	
	var textValue = "";
	if (textContainsChildren) {
		textValue = this.editor.xml2Str(this.xmlNode.children());
	} else {
		textValue = this.xmlNode.text();
	}
	
	this.textInput = this.createElementInput(this.guiElementID + "_text", 
			textValue, container);
	this.textInput.addClass('element_text');
	if (textContainsChildren)
		this.textInput.attr("disabled", "disabled");
};

XMLElement.prototype.addSubelementContainer = function (recursive) {
	var container = document.createElement('div');
	container.id = this.guiElementID + "_cont_elements";
	container.className = "content_block " + childrenContainerClass;
	this.guiElement[0].appendChild(container);
	this.childContainer = $(container);
	
	// Add all the subchildren
	if (recursive) {
		this.renderChildren(true);
	}
};

XMLElement.prototype.addAttributeContainer = function () {
	var container = document.createElement('div');
	container.id = this.guiElementID + "_cont_attributes";
	container.className = "content_block " + attributesContainerClass;
	this.guiElement[0].appendChild(container);
	this.attributeContainer = $(container);

	this.renderAttributes();
};

XMLElement.prototype.addElement = function(objectType) {
	if (!this.allowChildren)
		return null;
	
	var prefix = this.editor.xmlState.namespaces.getNamespacePrefix(objectType.namespace);
	
	// Create the new element in the target namespace with the matching prefix
	var xmlDocument = this.editor.xmlState.xml[0];
	var defaultValue = " ";
	if (objectType.values && objectType.values.length > 0)
		defaultValue = objectType.values[0];
	var newElement;
	if (xmlDocument.createElementNS) {
		newElement = xmlDocument.createElementNS(objectType.namespace, prefix + objectType.localName);
		newElement.appendChild(xmlDocument.createTextNode(defaultValue));
		this.xmlNode[0].appendChild(newElement);
	} else if (typeof(xmlDocument.createNode) != "undefined") {
		// Older IE versions
		newElement = xmlDocument.createNode(1, prefix + objectType.localName, objectType.namespace);
		newElement.appendChild(xmlDocument.createTextNode(defaultValue));
		this.xmlNode[0].appendChild(newElement);
	} else {
		throw new Exception("Unable to add child due to incompatible browser");
	}
	
	var childElement = new XMLElement(newElement, objectType, this.editor);
	this.childCount++;
	if (this.guiElement != null)
		childElement.render(this, true);
	
	return childElement;
};

XMLElement.prototype.syncText = function() {
	var newText = this.textInput.val();
	if (this.xmlNode[0].childNodes.length > 0) {
		this.xmlNode[0].childNodes[0].nodeValue = newText;
	} else {
		this.xmlNode[0].appendChild(document.createTextNode(newText));
	}
};

XMLElement.prototype.remove = function() {
	// Remove the element from the xml doc
	this.xmlNode.remove();
	
	if (this.guiElement != null) {
		this.guiElement.remove();
	}
};

XMLElement.prototype.swap = function (swapTarget) {
	if (swapTarget == null) {
		return;
	}
	
	// Swap the xml nodes
	swapTarget.xmlNode.detach().insertAfter(this.xmlNode);
	if (swapTarget.guiElement != null && this.guiElement != null) {
		// Swap the gui nodes
		swapTarget.guiElement.detach().insertAfter(this.guiElement);
	}
};

XMLElement.prototype.moveUp = function() {
	var previousSibling = this.guiElement.prev("." + xmlElementClass);
	if (previousSibling.length > 0) {
		this.swap(previousSibling.data("xmlElement"));
		return true;
	} else {
		return false;
	}
};

XMLElement.prototype.moveDown = function() {
	var nextSibling = this.guiElement.next("." + xmlElementClass);
	if (nextSibling.length > 0) {
		nextSibling.data("xmlElement").swap(this);
		return true;
	} else {
		return false;
	}
};

XMLElement.prototype.addAttribute = function (objectType) {
	var attributeValue = "";
	if (objectType.defaultValue) {
		attributeValue = objectType.defaultValue;
	} else if (objectType.values && objectType.values.length > 0) {
		// With enumerated attributes without a default, default to the first value
		attributeValue = objectType.values[0];
	}
	var node = this.xmlNode[0];
	var prefix;
	var attributeName = objectType.localName
	if (objectType.namespace != this.objectType.namespace) {
		prefix = this.editor.xmlState.namespaces.getNamespacePrefix(objectType.namespace);
		attributeName = prefix + attributeName;
	}
	if (node.setAttributeNS && prefix) {
		node.setAttributeNS(objectType.namespace, attributeName, attributeValue);
	} else this.xmlNode.attr(attributeName, attributeValue);
	return attributeValue;
};

XMLElement.prototype.removeAttribute = function (objectType) {
	this.xmlNode[0].removeAttribute(objectType.name);
};


XMLElement.prototype.getSelectedAttribute = function () {
	return this.attributeContainer.children(".selected");
};


XMLElement.prototype.updated = function (event) {
	if (this.guiElement == null)
		return;
	this.childCount = 0;
	this.attributeCount = 0;
	
	if (this.childContainer != null && this.objectType.elements) {
		this.childCount = this.childContainer[0].children.length;
		if (this.childCount > 0)
			this.childContainer.show();
		else this.childContainer.hide();
	}
	if (this.attributeContainer != null && this.objectType.attributes) {
		this.attributeCount = this.attributeContainer[0].children.length;
		if (this.attributeCount > 0)
			this.attributeContainer.show();
		else this.attributeContainer.hide();
	}
	
	if (!this.allowText && this.childCount == 0 && this.attributeCount == 0) {
		this.placeholder.show();
	} else {
		this.placeholder.hide();
	}
	
	if (this.editor.options.elementUpdated)
		this.editor.options.elementUpdated.call(this, event);
};

XMLElement.prototype.select = function() {
	this.guiElement.addClass("selected");
};

XMLElement.prototype.isSelected = function() {
	return this.guiElement.hasClass("selected");
};

XMLElement.prototype.getAttributeContainer = function() {
	return this.attributeContainer;
};

XMLElement.prototype.getChildContainer = function() {
	return this.childContainer;
};