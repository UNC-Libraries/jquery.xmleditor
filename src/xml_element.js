/**
 * Stores data related to a single xml element as it is represented in both the base XML 
 * document and GUI
 */
function XMLElement(xmlNode, objectType, editor) {
	AbstractXMLObject.call(this, editor, objectType);
	this.xmlNode = $(xmlNode);
	this.isTopLevel = (this.xmlNode.parents().length == 1);
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
	this.guiElement = $('<div/>').attr({
		'id' : this.guiElementID,
		'class' : this.objectType.nameEsc + 'Instance ' + xmlElementClass
	}).appendTo(this.parentElement.childContainer);
	if (this.isTopLevel) {
		this.guiElement.addClass(topLevelContainerClass);
	}
	
	this.guiElement.data("xmlElement", this);
	
	// Begin building contents
	this.elementHeader = $("<ul/>").attr({
		'class' : 'element_header'
	}).appendTo(this.guiElement);
	var elementNameContainer = $("<li class='element_name'/>").appendTo(this.elementHeader);

	// set up element title and entry field if appropriate
	$('<span/>').text(this.objectType.name).appendTo(elementNameContainer);

	// Add the subsections for the elements content next.
	this.addContentContainers(recursive);

	// Action buttons
	this.elementHeader.append(this.addTopActions(this.guiElementID));
	
	var self = this;
	
	this.guiElement.click(function(event) {
		self.editor.guiEditor.selectElement(self);
		event.stopPropagation();
	});
	
	this.initializeGUI();
	this.updated();
	
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
			}
		}
	});
};

XMLElement.prototype.renderAttributes = function () {
	var self = this;
	var attributesArray = this.objectType.attributes;
	
	$(this.xmlNode[0].attributes).each(function() {
		for ( var i = 0; i < attributesArray.length; i++) {
			if (attributesArray[i].name == this.nodeName) {
				var attribute = new XMLAttribute(attributesArray[i], self, self.editor);
				attribute.render();
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
	var topActionSpan = $("<li class='top_actions'/>");
	// create move up button and callback for element
	$('<input>').attr({
		'type' : 'button',
		'value' : '\u2193',
		'id' : this.guiElementID + '_down'
	}).appendTo(topActionSpan).click(function(){
		self.editor.guiEditor.moveSelected();
	});

	// create move up button and callback for element
	$('<input>').attr({
		'type' : 'button',
		'value' : '\u2191',
		'id' : this.guiElementID + '_up'
	}).appendTo(topActionSpan).click(function(){
		self.editor.guiEditor.moveSelected(true);
	});

	// create delete button and callback for element
	$('<input>').attr({
		'type' : 'button',
		'value' : 'X',
		'id' : this.guiElementID + '_del'
	}).appendTo(topActionSpan).click(function(){
		self.editor.guiEditor.deleteSelected();
	});
	
	return topActionSpan;
};

XMLElement.prototype.addContentContainers = function (recursive) {
	var attributesArray = this.objectType.attributes;
	var elementsArray = this.objectType.elements;
	
	if (attributesArray.length > 0){
		if (elementsArray.length > 0) {
			$("<div/>").addClass("placeholder").html("Use the menu to add subelements and attributes.").appendTo(this.guiElement);
		} else {
			$("<div/>").addClass("placeholder").html("Use the menu to add attributes.").appendTo(this.guiElement);
		}
	} else {
		$("<div/>").addClass("placeholder").html("Use the menu to add subelements.").appendTo(this.guiElement);
	}

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
	var container = $("<div/>").attr({'id' : this.guiElementID + "_cont_text", 
		"class": "content_block"});
	this.guiElement.append(container);
	var textContainsChildren = this.xmlNode.children().length > 0;
	
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
	var self = this;
	this.textInput.change(function() {
		self.syncText();
		self.editor.xmlState.documentChangedEvent();
	});
};

XMLElement.prototype.addSubelementContainer = function (recursive) {
	var container = $("<div/>").attr({'id' : this.guiElementID + "_cont_elements", 
		"class": "content_block " + childrenContainerClass});
	this.guiElement.append(container);
	this.childContainer = container;
	
	// Add all the subchildren
	if (recursive) {
		this.renderChildren(true);
	}
};

XMLElement.prototype.addAttributeContainer = function () {
	var container = $("<div/>").attr({'id' : this.guiElementID + "_cont_attributes", 
		"class": "content_block " + attributesContainerClass});
	this.guiElement.append(container);
	this.attributeContainer = container;

	this.renderAttributes();
};

XMLElement.prototype.addElement = function(objectType) {
	if (!this.allowChildren)
		return null;
	
	var prefix = this.editor.xmlState.namespaces.getNamespacePrefix(objectType.namespace);
	
	// Create the new element in the target namespace with the matching prefix
	var newElement = this.editor.xmlState.xml[0].createElementNS(objectType.namespace, prefix + objectType.localName);
	$(newElement).text(" ");
	this.xmlNode.append(newElement);
	
	var childElement = new XMLElement(newElement, objectType, this.editor);
	this.childCount++;
	if (this.guiElement != null)
		childElement.render(this, true);
	
	this.updated();
	
	return childElement;
};

XMLElement.prototype.syncText = function() {
	this.xmlNode.text(this.textInput.val());
};

XMLElement.prototype.childRemoved = function(child) {
	this.updated();
};

XMLElement.prototype.attributeRemoved = function(child) {
	this.updated();
};

XMLElement.prototype.remove = function() {
	// Remove the element from the xml doc
	this.xmlNode.remove();
	
	if (this.guiElement != null) {
		this.guiElement.remove();
	}
	
	// Notify parent this object was removed
	if (this.parentElement != null) {
		this.parentElement.childRemoved(this);
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
	}
	this.xmlNode.attr(objectType.name, attributeValue);
	return attributeValue;
};

XMLElement.prototype.removeAttribute = function (objectType) {
	this.xmlNode[0].removeAttribute(objectType.name);
	this.updated();
};


XMLElement.prototype.getSelectedAttribute = function () {
	return this.attributeContainer.children("." + attributeContainerClass + ".selected");
};


XMLElement.prototype.updated = function () {
	if (this.guiElement == null)
		return;
	this.childCount = (this.objectType.elements.length == 0)? 0: this.childContainer.children("." + xmlElementClass).length;
	this.attributeCount = (this.objectType.attributes == null || this.objectType.attributes.length == 0)? 0: this.guiElement.children("." + attributesContainerClass).children("." + attributeContainerClass).length;
	
	if (this.childCount > 0) {
		this.guiElement.children("." + childrenContainerClass).show();
	} else {
		this.guiElement.children("." + childrenContainerClass).hide();
	}
	if (this.attributeCount > 0) {
		this.guiElement.children("." + attributesContainerClass).show();
	} else {
		this.guiElement.children("." + attributesContainerClass).hide();
	}
	
	if (!this.allowText && this.childCount == 0 && this.attributeCount == 0) {
		this.guiElement.children(".placeholder").show();
	} else {
		this.guiElement.children(".placeholder").hide();
	}
};

XMLElement.prototype.select = function() {
	this.guiElement.addClass("selected");
};
