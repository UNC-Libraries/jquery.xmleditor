function XMLElementStub(editor) {
	this.objectType = {
		elementStub : true
	};
	this.editor = editor;
	this.guiEditor = this.editor.guiEditor;
	// dom element header for this element
	this.elementHeader = null;
	// dom element which contains the display of child nodes
	this.titleElement = null;

	this.tagName = "";
}

XMLElementStub.prototype.render = function(parentElement, prepend, relativeToXMLElement) {
	this.parentElement = parentElement;
	this.domNodeID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.domNode = document.createElement('div');
	var $domNode = $(this.domNode);
	this.domNode.id = this.domNodeID;
	this.domNode.className = 'xml_node xml_stub ' + xmlElementClass;
	if (this.isTopLevel)
		this.domNode.className += ' ' + topLevelContainerClass;
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

	// set up element title and entry field if appropriate
	this.titleElement = $("<span contenteditable='true' class='edit_title'/>");
	this.titleElement.appendTo(elementNameContainer);

	var self = this;

	var createLink = $("<span class='create_element'>create element</span>").appendTo(elementNameContainer).mouseup(function(e){
		self.create();
	});


	this.elementHeader.appendChild(this.addTopActions(this.domNodeID));

	this.domNode = $domNode;
	this.domNode.data("xmlObject", this);

	stubNameInput.call(this, this.titleElement, parentElement.objectType.elements);
};

function stubNameInput(nameInput, suggestionList, validItemFunction) {
	var self = this;
	var autocompleteEnabled = false;
	
	nameInput.keydown(function(e) {
		// escape, cancel
		if (e.keyCode == 27) {
			if (autocompleteEnabled && $(nameInput.xml_autocomplete('widget')).is(':visible')) {
				nameInput.xml_autocomplete('close');
			} else {
				self.remove();
				self.guiEditor.selectNode(self.parentElement);
			}
			return false;
		}
		
		// Enter, create
		if (e.keyCode == 13) {
			self.create();
			return false;
		}

		// Prevent spaces
		if (e.keyCode == 32) {
			return false;
		}

		// Block propagation of text editing keys
		if (e.which >= 37 && e.which <= 40 || e.which == 46) {
			e.stopPropagation();
		}
	});

	// Activate autocompletion dropdown for possible child elements defined in schema
	if (suggestionList && suggestionList.length > 0) {
		var suggDefs = [];
		var xmlState = this.editor.xmlState;

		for (var i in suggestionList) {
			var definition = suggestionList[i];
			suggDefs.push(xmlState.getNamespacePrefix(definition.namespace) + definition.localName);
		}

		nameInput.xml_autocomplete({ source : suggDefs, minLength: 0, delay: 0,
			matchSize : nameInput, validItemFunction : validItemFunction});
		autocompleteEnabled = true;
	}

	nameInput.focus(function(e) {
		self.guiEditor.selectNode(self);
		if (autocompleteEnabled)
			nameInput.xml_autocomplete("search", nameInput.text());
		e.stopPropagation();
	})
	.mousedown(function(e) {
		nameInput.focus();
		e.stopPropagation();
	});
}

XMLElementStub.prototype.addTopActions = function () {
	var self = this;
	var topActionSpan = document.createElement('li');
	topActionSpan.className = 'top_actions';
	
	var deleteButton = document.createElement('span');
	deleteButton.className = 'xml_delete';
	deleteButton.id = this.domNodeID + '_del';
	deleteButton.appendChild(document.createTextNode('X'));
	topActionSpan.appendChild(deleteButton);
	
	return topActionSpan;
};

XMLElementStub.prototype.remove = function() {
	this.domNode.remove();
};

XMLElementStub.prototype.create = function() {
	var tagName = this.titleElement.text();

	var nextSiblings = this.domNode.nextAll(".xml_node:not(.xml_stub)");
	var relativeTo = null;
	if (nextSiblings.length > 0) {
		relativeTo = nextSiblings.first().data("xmlObject");
	}

	var newElement = this.editor.addChildElement(this.parentElement, tagName, relativeTo, relativeTo != null);
	if (newElement instanceof AbstractXMLObject) {
		// Move new element to match display position of the stub, in case it was misplaced because of its siblings being stubs
		newElement.domNode.detach();
		this.domNode.after(newElement.domNode);

		this.remove();
	} else {
		console.log(newElement);
	}
};

XMLElementStub.prototype.getSelectedAttribute = function () {
	return [];
};

XMLElementStub.prototype.select = function() {
	this.domNode.addClass("selected");
};

XMLElementStub.prototype.isSelected = function() {
	return this.domNode.hasClass("selected");
};

XMLElementStub.prototype.focus = function() {
	this.titleElement.focus();
};