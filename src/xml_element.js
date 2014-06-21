/**
 * Stores data related to a single xml element as it is represented in both the base XML 
 * document and GUI
 */
function XMLElement(xmlNode, objectType, editor) {
	AbstractXMLObject.call(this, objectType, editor);
	// jquery object reference to the xml node represented by this object in the active xml document
	this.xmlNode = $(xmlNode);
	this.isRootElement = this.xmlNode[0].parentNode === this.xmlNode[0].ownerDocument;
	// Flag indicating if this element is a child of the root node
	this.isTopLevel = this.xmlNode[0].parentNode.parentNode === this.xmlNode[0].ownerDocument;
	// Flag indicating if any children nodes can be added to this element
	this.allowChildren = this.objectType.elements.length > 0;
	// Flag indicating if any attributes can be added to this element
	this.allowAttributes = this.objectType.attributes && this.objectType.attributes.length > 0;
	// Should this element allow text nodes to be added
	this.allowText = this.objectType.type != null;
	// dom element header for this element
	this.elementHeader = null;
	// dom element which contains the display of child nodes
	this.nodeContainer = null;
	// Counter for total number of immediate children of this element
	this.nodeCount = 0;
	// dom element for attributes
	this.attributeContainer = null;
	// Counter for number of attributes assigned to this element
	this.attributeCount = 0;
	// Map of child element type counts, used for constraining number of each type of child element
	this.presentChildren = {};
	// Array of element counts belonging to each choice block on this element definition
	// Order of counts matches the order of choice blocks from the schema definition
	this.choiceCount = [];
}

XMLElement.prototype.constructor = XMLElement;
XMLElement.prototype = Object.create( AbstractXMLObject.prototype );

// Render the GUI view of this element and all of its subelements/attributes
// parentElement - the XMLElement parent of this element
// recursive - Boolean which indicates whether to render this elements subelements
// Returns the newly created GUI dom element
XMLElement.prototype.render = function(parentElement, recursive, relativeToXMLElement, prepend) {
	this.parentElement = parentElement;
	this.domNodeID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.domNode = document.createElement('div');
	var $domNode = $(this.domNode);
	this.domNode.id = this.domNodeID;
	this.domNode.className = this.objectType.localName + "_" + this.objectType.ns  + 'Instance ' + xmlElementClass;
	if (this.isTopLevel)
		this.domNode.className += ' ' + topLevelContainerClass;
	if (this.isRootElement)
		this.domNode.className += ' xml_root_element';
	if (this.parentElement) {
		if (relativeToXMLElement) {
			if (prepend)
				$domNode.insertBefore(relativeToXMLElement.domNode);
			else
				$domNode.insertAfter(relativeToXMLElement.domNode);
		} else {
			if (prepend)
				this.parentElement.nodeContainer.prepend(this.domNode);
			else
				this.parentElement.nodeContainer[0].appendChild(this.domNode);
		}
	}
	
	// Begin building contents
	this.elementHeader = document.createElement('ul');
	this.elementHeader.className = 'element_header';
	this.domNode.appendChild(this.elementHeader);
	var elementNameContainer = document.createElement('li');
	elementNameContainer.className = 'element_name';
	this.elementHeader.appendChild(elementNameContainer);

	if (this.objectType.schema)
		this.elementName = this.xmlNode[0].tagName;
	else {
		this.elementName = this.editor.xmlState.namespaces.getNamespacePrefix(this.objectType.namespace)
		+ this.objectType.localName;
	}
	
	// set up element title and entry field if appropriate
	var titleElement = document.createElement('span');
	titleElement.appendChild(document.createTextNode(this.elementName));
	elementNameContainer.appendChild(titleElement);
	
	// Switch gui element over to a jquery object
	this.domNode = $domNode;
	this.domNode.data("xmlObject", this);

	// Add the subsections for the elements content next.
	this.addContentContainers(recursive);

	// Action buttons
	if (!this.isRootElement)
		this.elementHeader.appendChild(this.addTopActions(this.domNodeID));
	
	this.initializeGUI();
	this.updated({action : 'render'});
	
	return this.domNode;
};

// Render children elements
// recursive - if false, then only the immediate children will be rendered
XMLElement.prototype.renderChildren = function(recursive) {
	this.nodeCount = 0;
	this.domNode.children("." + xmlElementClass).remove();
	
	var elementsArray = this.objectType.elements;
	var self = this;
	this.xmlNode.children().each(function() {
		for ( var i = 0; i < elementsArray.length; i++) {
			var prefix = self.editor.xmlState.namespaces.getNamespacePrefix(elementsArray[i].namespace);
			if (prefix + elementsArray[i].localName == this.nodeName) {
				var childElement = new XMLElement($(this), elementsArray[i], self.editor);
				childElement.render(self, recursive);
				self.addChildrenCount(childElement);
				return;
			}
		}
	});
};

// Render all present attributes for this elements
XMLElement.prototype.renderAttributes = function () {
	var self = this;
	var attributesArray = this.objectType.attributes;
	if (!attributesArray)
		return;
	
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

// Updates child count tracking for the given element
XMLElement.prototype.addChildrenCount = function(childElement) {
	this.updateChildrenCount(childElement, 1);
};

// Inform element that a specific child element has been removed
XMLElement.prototype.childRemoved = function(childElement) {
	this.updateChildrenCount(childElement, -1);
};

/**
 * Updates child occurrence counts in response to a newly added child element
 */
XMLElement.prototype.updateChildrenCount = function(childElement, delta) {
	var self = this;
	this.nodeCount += delta;
	var childName = childElement.objectType.ns + ":" + childElement.objectType.localName;
	var choiceList = self.objectType.choices;
	// Update child type counts
	if (self.presentChildren[childName])
		self.presentChildren[childName] += delta;
	else
		self.presentChildren[childName] = delta > 0? delta : 0;
	if (choiceList) {
		for (var i = 0; i < choiceList.length; i++) {
			if ($.inArray(childName, choiceList[i].elements) > -1) {
				if (self.choiceCount[i])
					self.choiceCount[i] += delta;
				else
					self.choiceCount[i] = delta > 0? delta : 0;
			}
		}
	}
	
	return;
};

// Returns true if any more children of type childType can be added to this element
XMLElement.prototype.childCanBeAdded = function(childType) {
	if (!this.editor.options.enforceOccurs) return true;
	var childName = childType.ns + ":" + childType.localName;
	var presentCount = this.presentChildren[childName] || 0;
	// For the moment, if occur is not set, then pretend its unbound until the other limits are implemented
	// Normally, this should be defaulting to 1
	var maxOccurs = this.objectType.occurs && childName in this.objectType.occurs? 
			this.objectType.occurs[childName].max : "unbounded";
	if (maxOccurs != null && maxOccurs != 'unbounded' && presentCount >= maxOccurs)
		return false;
	
	// Check choices list to see if there are any choice restrictions on this type
	var choiceList = this.objectType.choices;
	if (choiceList) {
		for (var i = 0; i < choiceList.length; i++) {
			if ($.inArray(childName, choiceList[i].elements) > -1) {
				var choiceCount = this.choiceCount[i] || 0;
				if (choiceList[i].maxOccurs && choiceCount >= choiceList[i].maxOccurs)
					return false;
			}
		}
	}
	
	return true;
};

// Returns true if an element of definition childType can be removed from this element, according to
// minimum occurrence restrictions
XMLElement.prototype.childCanBeRemoved = function(childType) {
	if (!this.editor.options.enforceOccurs) return true;
	// Not checking min for groups or choices to avoid irreplaceable children
	var childName = childType.ns + ":" + childType.localName;
	if (this.presentChildren[childName] && this.objectType.occurs && childName in this.objectType.occurs)
		return (this.presentChildren[childName] > this.objectType.occurs[childName].min);
	return true;
};

// Populate the minimum number of children needed for this element to be valid
XMLElement.prototype.populateChildren = function() {
	if (!this.editor.options.enforceOccurs) return;
	var self = this;
	$.each(this.objectType.elements, function(){
		var childName = this.ns + ":" + this.localName;
		if (self.objectType.occurs && childName in self.objectType.occurs) {
			var minOccurs = self.objectType.occurs[childName].min;
			if (minOccurs) {
				for (var i = 0; i < minOccurs; i++) {
					var childElement = self.addElement(this);
					self.editor.activeEditor.addElementEvent(self, childElement);
				}
			}
		}
	});
};

XMLElement.prototype.initializeGUI = function () {
	var self = this;
	if (this.nodeContainer != null) {
		// Enable sorting of this element's child nodes
		this.nodeContainer.sortable({
			distance: 10,
			items: '> .' + xmlNodeClass,
			update: function(event, ui) {
				self.editor.guiEditor.updateElementPosition($(ui.item));
			}
		});
	}
};

// Generate buttons for performing move and delete actions on this element
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
	moveDown.id = this.domNodeID + '_down';
	moveDown.appendChild(document.createTextNode('\u2193'));
	topActionSpan.appendChild(moveDown);
	
	var moveUp = document.createElement('span');
	moveUp.className = 'move_up';
	moveUp.id = this.domNodeID + '_up';
	moveUp.appendChild(document.createTextNode('\u2191'));
	topActionSpan.appendChild(moveUp);
	
	var deleteButton = document.createElement('span');
	deleteButton.className = 'xml_delete';
	deleteButton.id = this.domNodeID + '_del';
	deleteButton.appendChild(document.createTextNode('X'));
	topActionSpan.appendChild(deleteButton);
	
	return topActionSpan;
};

// Generates GUI containers for the content panels of this element, including children elements,
// attributes and text
XMLElement.prototype.addContentContainers = function (recursive) {
	var attributesArray = this.objectType.attributes;
	var elementsArray = this.objectType.elements;
	
	var placeholder = document.createElement('div');
	placeholder.className = 'placeholder';

	var allowAttributes

	if (this.allowText) {
		if (this.allowAttributes) {
			if (this.allowChildren) {
				placeholder.appendChild(document.createTextNode('Use the menu to add subelements, attributes and text.'));
			} else {
				placeholder.appendChild(document.createTextNode('Use the menu to add attributes and text.'));
			}
		} else if (this.allowChildren) {
			placeholder.appendChild(document.createTextNode('Use the menu to add subelements and text.'));
		} else {
			placeholder.appendChild(document.createTextNode('Use the menu to add text.'));
		}
	} else {
		if (this.allowAttributes) {
			if (this.allowChildren) {
				placeholder.appendChild(document.createTextNode('Use the menu to add subelements and attributes.'));
			} else {
				placeholder.appendChild(document.createTextNode('Use the menu to add attributes.'));
			}
		} else if (this.allowChildren) {
			placeholder.appendChild(document.createTextNode('Use the menu to add subelements.'));
		}
	}

	this.placeholder = $(placeholder);
	this.domNode.append(this.placeholder);
	
	if (attributesArray && attributesArray.length > 0) {
		this.addAttributeContainer();
	}

	this.addNodeContainer(recursive);
};

XMLElement.prototype.addNodeContainer = function (recursive) {
	var container = document.createElement('div');
	container.id = this.domNodeID + "_cont_nodes";
	container.className = 'content_block';
	this.nodeContainer = $(container);
	this.domNode[0].appendChild(container);

	this.nodeCount = 0;

	var textContainsChildren = this.xmlNode[0].children && this.xmlNode[0].children.length > 0;
	var textAllowed = this.objectType.type != null && this.objectType.type != "mixed";

	var childNodes = this.xmlNode[0].childNodes;
	for (var i in childNodes) {
		var childNode = childNodes[i];

		switch (childNode.nodeType) {
			case 1 : // element
				this.renderChild(childNode, recursive);
				break;
			case 3 : // text
				if (textAllowed)
					this.renderText(childNode);
				break;
			case 4 : // cdata
				this.renderCData(childNode);
				break;
			case 8 : // comment
				break;
		}
	}

	// Add in a default text node if applicable and none present
	if (textAllowed && this.nodeCount == 0) {
		this.renderText();
	}
};

// Render children elements
// recursive - if false, then only the immediate children will be rendered
XMLElement.prototype.renderChild = function(childNode, recursive) {
	
	var elementsArray = this.objectType.elements;

	for ( var i = 0; i < elementsArray.length; i++) {
		var prefix = this.editor.xmlState.namespaces.getNamespacePrefix(elementsArray[i].namespace);
		if (prefix + elementsArray[i].localName == childNode.nodeName) {
			var childElement = new XMLElement($(childNode), elementsArray[i], this.editor);
			childElement.render(this, recursive);
			this.addChildrenCount(childElement);
			return;
		}
	}
};

XMLElement.prototype.renderText = function(childNode) {
	var textNode = new XMLTextNode(childNode, this.objectType.type, this.editor);
	textNode.render(this);

	this.nodeCount++;

	return textNode;
};

XMLElement.prototype.renderCData = function(childNode) {
	var cdataNode = new XMLCDataNode(childNode, this.editor);
	cdataNode.render(this);

	this.nodeCount++;

	return cdataNode;
};

XMLElement.prototype.addAttributeContainer = function () {
	var container = document.createElement('div');
	container.id = this.domNodeID + "_cont_attributes";
	container.className = "content_block " + attributesContainerClass;
	this.domNode[0].appendChild(container);
	this.attributeContainer = $(container);

	this.renderAttributes();
};

// Add a child element of type objectType and update the interface
XMLElement.prototype.addElement = function(objectType, relativeToXMLElement, prepend) {
	if (!this.allowChildren)
		return null;
	
	var prefix = this.editor.xmlState.namespaces.getNamespacePrefix(objectType.namespace);
	
	// Create the new element in the target namespace with the matching prefix
	var xmlDocument = this.editor.xmlState.xml[0];
	var defaultValue = null;
	if (objectType.values && objectType.values.length > 0)
		defaultValue = objectType.values[0];
	var newElement;
	if (xmlDocument.createElementNS) {
		newElement = xmlDocument.createElementNS(objectType.namespace, prefix + objectType.localName);
	} else if (typeof(xmlDocument.createNode) != "undefined") {
		// Older IE versions
		newElement = xmlDocument.createNode(1, prefix + objectType.localName, objectType.namespace);
	} else {
		throw new Exception("Unable to add child due to incompatible browser");
	}
	if (defaultValue)
		newElement.appendChild(xmlDocument.createTextNode(defaultValue));
	if (relativeToXMLElement) {
		if (prepend)
			$(newElement).insertBefore(relativeToXMLElement.xmlNode);
		else
			$(newElement).insertAfter(relativeToXMLElement.xmlNode);
	} else {
		if (prepend)
			this.xmlNode.prepend(newElement);
		else
			this.xmlNode[0].appendChild(newElement);
	}
	
	var childElement = new XMLElement(newElement, objectType, this.editor);
	this.addChildrenCount(childElement);
	if (this.domNode != null)
		childElement.render(this, true, relativeToXMLElement, prepend);
	childElement.populateChildren();
	
	return childElement;
};

// Swap the gui representation of this element to the location of swapTarget
XMLElement.prototype.swap = function (swapTarget) {
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
XMLElement.prototype.moveUp = function() {
	var previousSibling = this.domNode.prev("." + xmlElementClass);
	if (previousSibling.length > 0) {
		this.swap(previousSibling.data("xmlObject"));
		return true;
	} else {
		return false;
	}
};

// Move this element down one location in the gui.  Returns true if the swap was able to happen
XMLElement.prototype.moveDown = function() {
	var nextSibling = this.domNode.next("." + xmlElementClass);
	if (nextSibling.length > 0) {
		nextSibling.data("xmlObject").swap(this);
		return true;
	} else {
		return false;
	}
};

// Add a new attribute of type objectType to this element
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

XMLElement.prototype.addTextNode = function () {
	return this.renderText();
};

XMLElement.prototype.addCDataNode = function () {
	return this.renderCData();
};

// Remove an attribute of type objectType from this element
// "name" seems to come in with a namespace sometimes, localName does not.
XMLElement.prototype.removeAttribute = function (objectType) {
	var node = this.xmlNode[0];
	var localName = objectType.localName;
	var has_ns = node.hasAttributeNS(objectType.namespace, localName);

	if(has_ns) {
		var attr_name = objectType.name.split(':');
		node.removeAttributeNS(objectType.namespace, localName);
		node.removeAttribute("xmlns:" + attr_name[0]);
	} else {
		node.removeAttribute(localName);
	}
};

// Get the dom node for the currently selected attribute in this element
XMLElement.prototype.getSelectedAttribute = function () {
	return this.attributeContainer? this.attributeContainer.children(".selected") : [];
};

// Inform the element that its contents have been update, so that it can refresh itself
XMLElement.prototype.updated = function (event) {
	if (this.domNode == null)
		return;
	this.nodeCount = 0;
	this.attributeCount = 0;
	
	if (this.nodeContainer != null && this.objectType.elements) {
		this.nodeCount = this.nodeContainer.children("." + xmlElementClass).length 
				+ this.nodeContainer.children("." + xmlTextClass).length;
		if (this.nodeCount > 0)
			this.nodeContainer.show();
		else this.nodeContainer.hide();
	}
	if (this.attributeContainer != null && this.objectType.attributes) {
		this.attributeCount = this.attributeContainer[0].children.length;
		if (this.attributeCount > 0)
			this.attributeContainer.show();
		else this.attributeContainer.hide();
	}
	
	// Show or hide the instructional placeholder depending on if there are any contents in the element
	if (this.nodeCount == 0 && this.attributeCount == 0) {
		this.placeholder.show();
	} else {
		this.placeholder.hide();
	}
	
	if (this.editor.options.elementUpdated)
		this.editor.options.elementUpdated.call(this, event);
};

XMLElement.prototype.select = function() {
	this.domNode.addClass("selected");
};

XMLElement.prototype.isSelected = function() {
	return this.domNode.hasClass("selected");
};

XMLElement.prototype.getAttributeContainer = function() {
	return this.attributeContainer;
};

XMLElement.prototype.getChildContainer = function() {
	return this.childContainer;
};