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
	this.allowChildren = this.objectType.elements.length > 0 || this.objectType.any;
	// Flag indicating if any attributes can be added to this element
	this.allowAttributes = this.objectType.anyAttribute || (this.objectType.attributes && this.objectType.attributes.length > 0);
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
XMLElement.prototype.render = function(parentElement, recursive, relativeTo, prepend) {
	this.parentElement = parentElement;
	this.domNodeID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.domElement = document.createElement('div');
	this.domNode = $(this.domElement);

	this.domElement.id = this.domNodeID;
	this.domElement.className = this.objectType.localName + "_" + this.objectType.ns  + 'Instance ' + xmlNodeClass + ' ' + xmlElementClass;
	if (this.isTopLevel)
		this.domElement.className += ' ' + topLevelContainerClass;
	if (this.isRootElement)
		this.domElement.className += ' xml_root_element';
	
	this.insertDOMNode(relativeTo, prepend);
	
	// Begin building contents
	this.elementHeader = document.createElement('ul');
	this.elementHeader.className = 'element_header';
	this.domElement.appendChild(this.elementHeader);
	var elementNameContainer = document.createElement('li');
	elementNameContainer.className = 'element_name';
	this.elementHeader.appendChild(elementNameContainer);

	if (this.objectType.schema)
		this.elementName = this.xmlNode[0].tagName;
	else {
		this.elementName = this.editor.xmlState.getNamespacePrefix(this.objectType.namespace) 
		+ this.objectType.localName;
	}
	
	// set up element title and entry field if appropriate
	var titleElement = document.createElement('span');
	titleElement.appendChild(document.createTextNode(this.elementName));
	elementNameContainer.appendChild(titleElement);
	
	// Switch gui element over to a jquery object
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

XMLElement.prototype.insertDOMNode = function (relativeTo, prepend) {
	if (this.parentElement) {
		if (relativeTo) {
			if (prepend)
				this.domNode.insertBefore(relativeTo.domNode);
			else
				this.domNode.insertAfter(relativeTo.domNode);
		} else {
			if (prepend)
				this.parentElement.nodeContainer.prepend(this.domNode);
			else
				this.parentElement.nodeContainer[0].appendChild(this.domElement);
		}
	}
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
	if (!this.allowChildren)
		return false;
	
	// Verify that this new child definition would not violate occurrance limits
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
	
	this.toggleCollapse = document.createElement('span');
	this.toggleCollapse.className = 'toggle_collapse';
	this.toggleCollapse.id = this.guiElementID + '_toggle_collapse';
	this.toggleCollapse.appendChild(document.createTextNode('_'));
	topActionSpan.appendChild(this.toggleCollapse);
	
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

	this.contentContainer = document.createElement("div");
	this.domElement.appendChild(this.contentContainer);
	
	var placeholder = document.createElement('div');
	placeholder.className = 'placeholder';

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

	this.contentContainer.appendChild(placeholder);
	this.placeholder = $(placeholder);
	
	if (attributesArray && attributesArray.length > 0) {
		this.addAttributeContainer();
	}

	this.addNodeContainer(recursive);
};

XMLElement.prototype.addNodeContainer = function (recursive) {
	var container = document.createElement('div');
	container.id = this.domNodeID + "_cont_nodes";
	container.className = 'content_block xml_children';
	this.nodeContainer = $(container);
	this.contentContainer.appendChild(container);

	this.nodeCount = 0;

	var textContainsChildren = this.xmlNode[0].children && this.xmlNode[0].children.length > 0;

	var childNodes = this.xmlNode[0].childNodes;
	for (var i in childNodes) {
		var childNode = childNodes[i];

		switch (childNode.nodeType) {
			case 1 : // element
				this.renderChild(childNode, recursive);
				break;
			case 3 : // text
				if (this.allowText && childNode.nodeValue.trim())
					this.renderText(childNode);
				break;
			case 4 : // cdata
				this.renderCData(childNode);
				break;
			case 8 : // comment
				this.renderComment(childNode);
				break;
		}
	}

	// Add in a default text node if applicable and none present
	if (this.allowText && this.nodeCount == 0 &&
			(this.objectType.type != "mixed" || !this.objectType.any)) {
		this.renderText();
	}
};

// Render children elements
// recursive - if false, then only the immediate children will be rendered
XMLElement.prototype.renderChild = function(childNode, recursive) {
	
	var elementsArray = this.objectType.elements;

	if (elementsArray) {
		for ( var i = 0; i < elementsArray.length; i++) {
			var prefix = this.editor.xmlState.getNamespacePrefix(elementsArray[i].namespace);
			if (prefix + elementsArray[i].localName == childNode.nodeName) {
				var childElement = new XMLElement($(childNode), elementsArray[i], this.editor);
				childElement.render(this, recursive);
				this.addChildrenCount(childElement);
				return;
			}
		}
	}

	// Handle children that do not have a definition
	var childElement = new XMLUnspecifiedElement($(childNode), this.editor);
	childElement.render(this, recursive);
	this.addChildrenCount(childElement);
};

XMLElement.prototype.renderText = function(childNode, prepend) {
	var textNode = new XMLTextNode(childNode, this.objectType.type, this.editor);
	textNode.render(this, prepend);

	this.nodeCount++;

	return textNode;
};

XMLElement.prototype.renderCData = function(childNode, prepend) {
	var cdataNode = new XMLCDataNode(childNode, this.editor);
	cdataNode.render(this, prepend);

	this.nodeCount++;

	return cdataNode;
};

XMLElement.prototype.renderComment = function(childNode, prepend) {
	var node = new XMLCommentNode(childNode, this.editor);
	node.render(this, prepend);

	this.nodeCount++;

	return node;
};

XMLElement.prototype.renderElementStub = function(prepend, relativeTo) {
	var node = new XMLElementStub(this.editor);
	node.render(this, prepend, relativeTo);

	this.nodeCount++;

	return node;
};

XMLElement.prototype.renderAttributeStub = function() {
	var node = new XMLAttributeStub(this, this.editor);
	node.render();

	this.attributeCount++;

	return node;
};

XMLElement.prototype.addAttributeContainer = function () {
	var container = document.createElement('div');
	container.id = this.domNodeID + "_cont_attributes";
	container.className = "content_block " + attributesContainerClass;
	this.contentContainer.appendChild(container);
	this.attributeContainer = $(container);

	this.renderAttributes();
};

// Add a child element of type objectType and update the interface
XMLElement.prototype.addNonschemaElement = function(tagName, relativeTo, prepend) {

	var xmlDocument = this.editor.xmlState.xml[0];
	var newElement;
	try {
		newElement = xmlDocument.createElement(tagName);
	} catch(e) {
		// Name was probably invalid
		return null;
	}

	this.insertXMLNode(newElement, relativeTo, prepend);

	var childElement = new XMLUnspecifiedElement(newElement, this.editor);
	this.addChildrenCount(childElement);
	if (this.domNode != null)
		childElement.render(this, true, relativeTo, prepend);
	
	return childElement;

};

// Add a child element of type objectType and update the interface
XMLElement.prototype.addElement = function(objectType, relativeTo, prepend) {
	var prefix = this.editor.xmlState.getNamespacePrefix(objectType.namespace);
	
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
	
	this.insertXMLNode(newElement, relativeTo, prepend);
	
	var childElement = new XMLElement(newElement, objectType, this.editor);
	this.addChildrenCount(childElement);
	if (this.domNode != null)
		childElement.render(this, true, relativeTo, prepend);
	childElement.populateChildren();
	
	return childElement;
};

XMLElement.prototype.insertXMLNode = function (newElement, relativeTo, prepend) {
	if (relativeTo) {
		if (relativeTo instanceof XMLElementStub) {
			// Stubs don't have an xml node, so need to position based off nearest real node
			var nextSiblings = this.domNode.nextAll(".xml_node:not(.xml_stub)");
			if (nextSiblings.length > 0) {
				$(newElement).insertBefore(nextSiblings.first().data("xmlObject").xmlNode);
			} else {
				this.xmlNode[0].appendChild(newElement);
			}
		} else {
			if (prepend)
				$(newElement).insertBefore(relativeTo.xmlNode);
			else
				$(newElement).insertAfter(relativeTo.xmlNode);
		}
	} else {
		if (prepend)
			this.xmlNode.prepend(newElement);
		else
			this.xmlNode[0].appendChild(newElement);
	}
};

// Add a new attribute of type objectType to this element
XMLElement.prototype.addAttribute = function (objectType) {
	// Verify that the attribute is not already present on the element
	if (this.attributeExists(objectType)) {
		return null;
	}

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
		prefix = this.editor.xmlState.getNamespacePrefix(objectType.namespace);
		attributeName = prefix + attributeName;
	}
	if (node.setAttributeNS && prefix) {
		node.setAttributeNS(objectType.namespace, attributeName, attributeValue);
	} else this.xmlNode.attr(attributeName, attributeValue);

	var attribute = new XMLAttribute(objectType, this, this.editor);
	attribute.render();

	return attribute;
};

XMLElement.prototype.attributeExists = function(attrDefinition) {
	var attr;
	if ($.type(attrDefinition) == "string") {
		attr = attrDefinition;
	} else {
		if (attrDefinition.namespace != this.objectType.namespace) {
			attr = this.editor.xmlState.getNamespacePrefix(attrDefinition.namespace) + attrDefinition.localName;
		} else {
			attr = attrDefinition.localName;
		}
	}
	
	attr = this.xmlNode.attr(attr);

	return typeof attr !== typeof undefined && attr !== false;
};


XMLElement.prototype.addNode = function (nodeType, prepend, relativeTo) {
	this.nodeContainer.show();
	if (this.attributeContainer) {
		this.attributeContainer.show();
	}
	switch (nodeType) {
		case "text" :
			if (this.allowText)
				return this.renderText(null, prepend, relativeTo);
			else return null;
		case "cdata" : return this.renderCData(null, prepend, relativeTo);
		case "comment" : return this.renderComment(null, prepend, relativeTo);
		case "element" :
			if (this.allowChildren) {
				return this.renderElementStub(prepend, relativeTo);
			}
			return null;
		case "attribute" :
			if (this.allowAttributes) {
				return this.renderAttributeStub();
			}
			return null;
	}
	return null;
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
	
	if (this.nodeContainer != null) {
		this.nodeCount = this.nodeContainer.children("." + xmlElementClass).length 
				+ this.nodeContainer.children("." + xmlTextClass).length;
		if (this.nodeCount > 0)
			this.nodeContainer.show();
		else this.nodeContainer.hide();
	}
	if (this.attributeContainer != null) {
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

XMLElement.prototype.getAttributeContainer = function() {
	return this.attributeContainer;
};

XMLElement.prototype.getChildContainer = function() {
	return this.childContainer;
};

XMLElement.prototype.toggleCollapsed = function() {
	var collapsed = this.domNode.hasClass("collapsed");
	var contentBlock = $(this.contentContainer);

	var $toggle = $(this.toggleCollapse);
	var self = this;

	if (collapsed) {
		$toggle.html("_");
		contentBlock.slideDown(150);
		self.domNode.removeClass("collapsed");
	} else {
		$toggle.html("+");
		
		contentBlock.slideUp(150, function() {
			self.domNode.addClass("collapsed");
		});
	}
};