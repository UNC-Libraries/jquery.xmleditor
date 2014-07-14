/**
 * Graphical editor
 */
function GUIEditor(editor) {
	this.editor = editor;
	this.guiContent = null;
	this.xmlContent = null;
	this.elementIndex = 0;
	this.rootElement = null;
	this.active = false;
}

GUIEditor.prototype.initialize = function(parentContainer) {
	this.xmlContent = $("<div class='" + xmlContentClass + "'/>");
	this.xmlContent.data("xml", {});
	this.placeholder = $("<div/>").attr("class", "placeholder").html("There are no elements in this document.  Use the menu on the right to add new top level elements.")
			.appendTo(this.xmlContent);
	
	this.guiContent = $("<div/>").attr({'id' : guiContentClass + this.editor.instanceNumber, 'class' : guiContentClass}).appendTo(parentContainer);
	
	this.guiContent.append(this.xmlContent);
	
	this.documentElement = new AbstractXMLObject(null, this.editor);
	this.documentElement.domNode = this.xmlContent;
	this.documentElement.nodeContainer = this.xmlContent;
	this.documentElement.placeholder = this.placeholder;
	
	this.setRootElement(this.editor.xmlState.xml.children()[0], false);
	
	this._initEventBindings();
	return this;
};

// Set the root element for this editor 
// node - xml node from an xml document to be used as the root node for this editor
GUIEditor.prototype.setRootElement = function(node, render) {
	var objectType = this.editor.schemaTree.getElementDefinition(node);
	if (objectType == null)
		objectType = this.editor.schemaTree.rootElement;
	this.rootElement = new XMLElement(node, objectType, this.editor);
	if (render || arguments.length == 1)
		this.rootElement.render(this.documentElement, true);
};

// Initialize editor wide event bindings
GUIEditor.prototype._initEventBindings = function() {
	var self = this;
	// Attributes
	this.xmlContent.on('click', '.' + attributeContainerClass, function(event){
		$(this).data('xmlAttribute').select();
		event.stopPropagation();
	}).on('click', '.' + attributeContainerClass + " > a", function(event){
		var attribute = $(this).parents('.' + attributeContainerClass).eq(0).data('xmlAttribute');
		attribute.remove();
		attribute.xmlElement.updated({action : 'attributeRemoved', target : attribute});
		self.editor.xmlState.documentChangedEvent();
		event.stopPropagation();
	}).on('change', '.' + attributeContainerClass + ' > input,.' + attributeContainerClass + ' > textarea,'
			+ '.' + attributeContainerClass + ' > select', function(event){
		var attribute = $(this).parents('.' + attributeContainerClass).eq(0).data('xmlAttribute');
		attribute.syncValue();
		attribute.xmlElement.updated({action : 'attributeSynced', target : attribute});
		self.editor.xmlState.documentChangedEvent();
	});
	// Element
	this.xmlContent.on('click', '.' + xmlNodeClass, function(event){
		self.selectNode(this);
		event.stopPropagation();
	}).on('click', '.move_up', function(event){
		self.moveNode($(this).parents('.' + xmlElementClass).eq(0).data('xmlObject'), true);
		event.stopPropagation();
	}).on('click', '.move_down', function(event){
		self.moveNode($(this).parents('.' + xmlElementClass).eq(0).data('xmlObject'));
		event.stopPropagation();
	}).on('click', '.' + xmlTextClass + ' .xml_delete', function(event){
		self.deleteText($(this).parents('.' + xmlTextClass).eq(0).data('xmlObject'));
		event.stopPropagation();
	}).on('click', '.top_actions .xml_delete', function(event){
		self.deleteElement($(this).parents('.' + xmlElementClass).eq(0).data('xmlObject'));
		event.stopPropagation();
	}).on('click', '.toggle_collapse', function(event){
		var $this = $(this);
		var contentBlock = $this.closest('.' + xmlElementClass).find('.content_block');
		if ($this.html() == "+") {
			$this.html("_");
			contentBlock.slideDown(200);
		} else {
			$this.html("+");
			contentBlock.slideUp(200);
		}
		event.stopPropagation();
	}).on('change', '.element_text', function(event){
		var $this = $(this);
		var xmlElement = $this.parents('.' + xmlElementClass).eq(0).data('xmlObject');
		var textObject = $this.parents(".xml_node").first().data('xmlObject');
		if (!textObject) return;
		textObject.syncText();
		xmlElement.updated({action : 'valueSynced'});
		self.editor.xmlState.documentChangedEvent();
	}).on('focus', '.xml_text_node .xml_textarea', function(event) {
		var textObject = $(this).parents(".xml_node").first().data('xmlObject');
		textObject.select();
		event.stopPropagation();
	}).on('click', '.xml_text_node', function(event) {
		var textObject = $(this).data('xmlObject');
		textObject.select();
		event.stopPropagation();
	});
};

// Make this editor the active editor and show it
GUIEditor.prototype.activate = function() {
	this.active = true;
	this.deselect();
	
	this.editor.textEditor.resetSelectedTagRange();
	if (this.editor.textEditor.isModified() || (this.editor.textEditor.isInitialized() && this.editor.xmlState.isChanged())) {
		this.editor.refreshDisplay();
		this.editor.textEditor.setInitialized();
	}
	this.guiContent.show();
	return this;
};

// Deactivate and hide this editor
GUIEditor.prototype.deactivate = function() {
	this.active = false;
	this.guiContent.hide();
	return this;
};

// Get the next index in the sequence to be used for uniquely addressable ids
GUIEditor.prototype.nextIndex = function() {
	return xmlElementClass + (++this.elementIndex);
};

// Clear all elements
GUIEditor.prototype.clearElements = function() {
	$("." + topLevelContainerClass).remove();
	return this;
};

GUIEditor.prototype.resize = function() {
	//xmlContent.width(guiContent.width() - menuContainer.width() - 30);
	return this;
};

// Refresh the contents of this editor
GUIEditor.prototype.refreshDisplay = function() {
	this.deselect();
	this.elementIndex = 0;
	this.rootElement.xmlNode = this.editor.xmlState.xml.children().first();
	this.refreshElements();
	return this;
};

// Refresh the display of all elements
GUIEditor.prototype.refreshElements = function() {
	var node = this.documentElement.getDomNode();
	node.empty();
	node = node[0];
	var originalParent = node.parentNode;
	var fragment = document.createDocumentFragment();
	fragment.appendChild(node);
	
	// Clear out the previous contents and then rebuild it
	this.rootElement.render(this.documentElement, true);
	this.editor.addTopLevelMenu.populate(this.rootElement);
	
	originalParent.appendChild(fragment);
	return this;
};

// Inform the editor that a new element has been added, and update the editor state accordingly
GUIEditor.prototype.addElementEvent = function(parentElement, newElement) {
	if (parentElement.domNodeID != this.xmlContent.attr("id")) {
		parentElement.updated({action : 'childAdded', target : newElement});
	}
	
	var state = this.editor;

	this.focusObject(newElement.domNode);
	this.selectNode(newElement);
	if (parentElement == this.rootElement)
		this.editor.addTopLevelMenu.populate(this.rootElement);
	this.editor.xmlState.documentChangedEvent();
	this.editor.resize();
};

// Inform the editor that a new attribute has been added
GUIEditor.prototype.addAttributeEvent = function(parentElement, objectType, addButton) {
	var attribute = new XMLAttribute(objectType, parentElement, this.editor);
	attribute.render();
	parentElement.updated({action : 'attributeAdded', target : objectType.name});
	this.focusObject(attribute.domNode);
	addButton.addClass("disabled");
	attribute.addButton = addButton;
	this.editor.xmlState.documentChangedEvent();
	this.editor.resize();
};

GUIEditor.prototype.addNodeEvent = function(parentElement, xmlObject) {
	parentElement.updated({action : xmlObject.objectType.type + 'Added', target : parentElement});
	this.focusObject(xmlObject.domNode);
	this.editor.xmlState.documentChangedEvent();
	this.editor.resize();
}

GUIEditor.prototype.select = function(selected) {
	var container = selected.closest("." + attributeContainerClass + ",." + xmlNodeClass);
	if (container.is("." + attributeContainerClass)) {
		container.data("xmlAttribute").select();
	} else {
		this.selectNode(selected);
	}
}

// Select element selected and inform the editor state of this change
GUIEditor.prototype.selectNode = function(selected) {
	if (!selected || selected.length == 0) {
		this.deselect();
	} else {
		$(".selected").removeClass("selected");

		var selectedObject;
		if (selected instanceof Element || selected instanceof jQuery) {
			var $selected = $(selected);
			if ($selected.is("." + xmlNodeClass)) {
				selectedObject = $selected.data("xmlObject");
			} else {
				selectedObject = $selected.closest("." + xmlNodeClass).data("xmlObject");
			}
		} else {
			selectedObject = selected;
		}

		this.selectedNode = selectedObject;
		this.selectedElement = selectedObject;
		this.selectedNode.select();
		if (selectedObject instanceof XMLElement) {
			$("*:focus").blur();
		} else if (!(selectedObject instanceof XMLElementStub)) {
			this.selectedElement = selectedObject.parentElement;
			this.selectedNode.domNode.addClass("selected");
		} 
		
		this.editor.modifyMenu.refreshContextualMenus(this.selectedElement);
	}
	return this;
};

// Unselect the currently selected element or attribute
GUIEditor.prototype.deselect = function() {
	var selectedAttributes = $('.' + attributeContainerClass + ".selected");
	if (selectedAttributes.length > 0) {
		selectedAttributes.removeClass('selected');
		return this;
	}
	$("." + xmlNodeClass + ".selected").removeClass("selected");
	this.selectedNode = null;
	this.selectedElement = null;
	if (this.editor.modifyMenu != null)
		this.editor.modifyMenu.clearContextualMenus();
	return this;
};

// Delete the selected element or attribute
GUIEditor.prototype.deleteSelected = function() {
	if (this.selectedNode == null)
		return this;
	try {
		var selectedAttribute = this.selectedNode.getSelectedAttribute();
		if (selectedAttribute.length > 0) {
		this.selectAttribute(true);
		var newSelection = selectedAttribute.prev('.' + attributeContainerClass);
		if (newSelection.length == 0)
			newSelection = selectedAttribute.next('.' + attributeContainerClass);
			newSelection.addClass("selected");
			
			var xmlAttribute = selectedAttribute.data("xmlAttribute");
			xmlAttribute.remove();
			return this;
		}
	} catch(error) {
		// Attribute container undefined
	}
	if (this.selectedNode instanceof XMLElement) {
		this.deleteElement(this.selectedNode);
	} else {
		this.deleteText(this.selectedNode);
	}
	return this;
};

// Delete an element from the document and update the editor state
GUIEditor.prototype.deleteElement = function(xmlElement) {
	var parent = xmlElement.parentElement;
	var index = xmlElement.objectType.localName;
	if (!parent || !(parent instanceof XMLElement) || !parent.childCanBeRemoved(xmlElement.objectType))
		return;
	parent.childRemoved(xmlElement);
	var isSelected = xmlElement.isSelected();
	if (isSelected) {
		this.selectNode(this.afterDeleteSelection(xmlElement));
	} else if (parent.isSelected && parent != this.rootElement) {
		this.editor.modifyMenu.refreshContextualMenus(parent);
	}
	if (parent == this.rootElement) {
		this.editor.addTopLevelMenu.populate(this.rootElement);
	}
	xmlElement.remove();
	parent.updated({action : 'childRemoved', target : xmlElement});
	this.editor.xmlState.documentChangedEvent();
	return this;
};

GUIEditor.prototype.deleteText = function(xmlText) {
	var isSelected = xmlText.isSelected();
	if (isSelected) {
		this.selectNode(this.afterDeleteSelection(xmlText));
	}

	xmlText.remove();

	xmlText.parentElement.updated({action : 'textRemoved', target : xmlText});
	this.editor.xmlState.documentChangedEvent();
	return this;
};

GUIEditor.prototype.afterDeleteSelection = function(xmlNode) {
	var afterDeleteSelection = xmlNode.domNode.next("." + xmlNodeClass);
	if (afterDeleteSelection.length == 0)
		afterDeleteSelection = xmlNode.domNode.prev("." + xmlNodeClass);
	if (afterDeleteSelection.length == 0)
		afterDeleteSelection = xmlNode.domNode.parent().closest("." + xmlNodeClass);
	return afterDeleteSelection;
};

// Move the currently selected element by x number of positions
GUIEditor.prototype.moveSelected = function(up) {
	var selectedTextNode = $(".selected." + xmlTextClass);
	if (selectedTextNode.length > 0)
		return this.moveNode(selectedTextNode.data("xmlObject"), up);
	return this.moveNode(this.selectedNode, up);
};

// Move xmlObject by x number of positions
GUIEditor.prototype.moveNode = function(xmlObject, up) {
	if (xmlObject == null)
		return this;
	var result = up? xmlObject.moveUp() : xmlObject.moveDown();
	if (result) {
		this.editor.xmlState.documentChangedEvent();
		xmlObject.focus();
	}
	return this;
};

// Update an elements position in the XML document to reflect its position in the editor
GUIEditor.prototype.updateElementPosition = function(moved) {
	var movedElement = moved.data('xmlObject');

	if (movedElement.xmlNode) {
		var sibling = moved.prev('.' + xmlNodeClass);
		if (sibling.length == 0) {
			sibling = moved.next('.' + xmlNodeClass);
			movedElement.xmlNode.detach().insertBefore(sibling.data('xmlObject').xmlNode);
		} else {
			movedElement.xmlNode.detach().insertAfter(sibling.data('xmlObject').xmlNode);
		}
		this.editor.xmlState.documentChangedEvent();
	}
	
	this.selectNode(moved);
};

// Select the next or previous sibling element of the selected element
GUIEditor.prototype.selectSibling = function(reverse) {
	var direction = reverse? 'prev' : 'next';
	if (this.selectedNode.domNode.length > 0) {
		newSelection = this.selectedNode.domNode[direction]("." + xmlElementClass);
		if (newSelection.length == 0 && !this.selectedNode.isTopLevel) {
			// If there is no next sibling but the parent has one, then go to parents sibling
			this.selectedNode.domNode.parents("." + xmlElementClass).each(function(){
				newSelection = $(this)[direction]("." + xmlElementClass);
				if (newSelection.length > 0 || $(this).data("xmlObject").isTopLevel)
					return false;
			});
		}
	} else {
		if (!reverse)
			newSelection = $("." + xmlElementClass).first();
	}
	
	if (newSelection.length == 0)
		return this;
	this.selectNode(newSelection.first()).selectedNode.focus();
	return this;
};

// Select the parent of the currently selected element
GUIEditor.prototype.selectParent = function(reverse) {
	if (reverse)
		newSelection = this.selectedNode.domNode.find("." + xmlElementClass);
	else newSelection = this.selectedNode.domNode.parents("." + xmlElementClass);
	if (newSelection.length == 0)
		return this;
	this.selectNode(newSelection.first()).selectedNode.focus();
	return this;
};

// Select the next child of the currently selected element.  If it has no children,
// then select the next sibling if any are available.
GUIEditor.prototype.selectNext = function(reverse) {
	var newSelection = null;
	if (this.selectedNode == null) {
		if (!reverse)
			newSelection = $("." + xmlElementClass).first();
	} else {
		var found = false;
		var allElements = $("." + xmlElementClass + ":visible", this.xmlContent);
		
		if (reverse)
			allElements = $(allElements.get().reverse());
		
		var selectedNode = this.selectedNode;
		allElements.each(function(){
			if (found) {
				newSelection = $(this);
				return false;
			} else if (this.id == selectedNode.domNodeID) {
				found = true;
			}
		});
	}
	
	if (newSelection != null)
		this.selectNode(newSelection.first()).selectedNode.focus();
	return this;
};

// Select the previous or next attribute of the selected element
GUIEditor.prototype.selectAttribute = function(reverse) {
	if (this.selectedNode == null) {
		return this;
	} else {
		var selectedAttribute = this.selectedNode.getSelectedAttribute();
		if (selectedAttribute.length > 0) {
			var newSelection = selectedAttribute[reverse? 'prev' : 'next']("." + attributeContainerClass);
			if (newSelection.length > 0) {
				$("." + attributeContainerClass + ".selected").removeClass("selected");
				newSelection.addClass("selected");
			}
		} else {
			if (this.selectedNode.domNode)
				selectedAttribute = this.selectedNode.domNode.children("." + attributeContainerClass)
						.first().addClass("selected");
		}
	}
};

// Find and select the nearest element text field in an element or its children
GUIEditor.prototype.focusSelectedText = function() {
	if (this.selectedNode == null)
		return this;
	var focused = null;
	if (this.selectedNode.textInput != null) {
		focused = this.selectedNode.textInput.focus();
	} else {
		focused = this.selectedNode.domNode.find("input[type=text].element_text:visible, textarea.element_text:visible, select.element_text:visible").first().focus();
	}
	if (focused == null || focused.length == 0)
		return this;
	// If the focused input was in an element other than the selected one, then select it
	var containerElement = focused.parents("." + xmlElementClass);
	if (containerElement !== this.selectedNode)
		this.selectNode(containerElement);
	return this;
};

// Find and focus the nearest input field in the selected element or its children.  If the 
// input field focused belonged to a child, then select that child.
GUIEditor.prototype.focusInput = function(reverse) {
	var focused = $("input:focus, textarea:focus, select:focus, .edit_title:focus");
	if (focused.length == 0 && this.selectedNode == null) {
		if (reverse)
			return this;
		// Nothing is selected or focused, so grab the first available input
		focused = this.xmlContent.find("input[type=text]:visible, textarea:visible, select:visible, .edit_title:visible").first().focus();
	} else {
		// When an input is already focused, tabbing selects the next input
		var foundFocus = false;
		var inputsSelector = "input[type=text]:visible, textarea:visible, select:visible, .edit_title:visible";
		// If no inputs are focused but an element is selected, seek the next input near this element
		if (this.selectedNode != null && focused.length == 0) {
			inputsSelector += ", ." + xmlElementClass;
			focused = this.selectedNode.domNode;
		}
		var visibleInputs = this.xmlContent.find(inputsSelector);
		// If in reverse mode, get the previous input
		if (reverse) {
			visibleInputs = $(visibleInputs.get().reverse());
		}
		// Seek the next input after the focused one
		visibleInputs.each(function(){
			// Can't focus xml classes if they are present.
			if (foundFocus && !$(this).hasClass(xmlElementClass)) {
				focused = $(this).focus();
				return false;
			} else if (this === focused.get(0)) {
				foundFocus = true;
			}
		});
	}

	this.select(focused);
	return this;
};

// Return true if the given dom node is vertically completely on screen
GUIEditor.prototype.isCompletelyOnScreen = function(object) {
	var objectTop = object.offset().top;
	var objectBottom = objectTop + object.height();
	var docViewTop = $(window).scrollTop() + this.editor.editorHeader.height();
	var docViewBottom = docViewTop + $(window).height() - this.editor.editorHeader.height();

	return (docViewTop < objectTop) && (docViewBottom > objectBottom);
};

// If the given target is not completely on screen then scroll the window to the top of the target
GUIEditor.prototype.focusObject = function(focusTarget) {
	if (!this.isCompletelyOnScreen(focusTarget)){
		var scrollHeight = focusTarget.offset().top + (focusTarget.height()/2) - ($(window).height()/2);
		if (scrollHeight > focusTarget.offset().top)
			scrollHeight = focusTarget.offset().top;
		scrollHeight -= this.editor.editorHeader.height();
		$("html, body").stop().animate({ scrollTop: scrollHeight }, 500);
	}
};
