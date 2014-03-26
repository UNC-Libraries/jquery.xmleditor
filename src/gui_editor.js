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
	this.selectedElement = null;
}

GUIEditor.prototype.initialize = function(parentContainer) {
	this.xmlContent = $("<div class='" + xmlContentClass + "'/>");
	this.xmlContent.data("xml", {});
	this.placeholder = $("<div/>").attr("class", "placeholder").html("There are no elements in this document.  Use the menu on the right to add new top level elements.")
			.appendTo(this.xmlContent);
	
	this.guiContent = $("<div/>").attr({'id' : guiContentClass + this.editor.instanceNumber, 'class' : guiContentClass}).appendTo(parentContainer);
	
	this.guiContent.append(this.xmlContent);
	
	this.documentElement = new AbstractXMLObject(this.editor, null);
	this.documentElement.domNode = this.xmlContent;
	this.documentElement.childContainer = this.xmlContent;
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
	this.xmlContent.on('click', '.' + xmlElementClass, function(event){
		self.selectElement(this);
		event.stopPropagation();
	}).on('click', '.move_up', function(event){
		self.moveElement($(this).parents('.' + xmlElementClass).eq(0).data('xmlElement'), true);
		event.stopPropagation();
	}).on('click', '.move_down', function(event){
		self.moveElement($(this).parents('.' + xmlElementClass).eq(0).data('xmlElement'));
		event.stopPropagation();
	}).on('click', '.top_actions .delete', function(event){
		self.deleteElement($(this).parents('.' + xmlElementClass).eq(0).data('xmlElement'));
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
		var xmlElement = $(this).parents('.' + xmlElementClass).eq(0).data('xmlElement')
		xmlElement.syncText();
		xmlElement.updated({action : 'valueSynced'});
		self.editor.xmlState.documentChangedEvent();
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
	this.selectElement(newElement);
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
	this.focusObject(attribute.attributeContainer);
	addButton.addClass("disabled");
	attribute.addButton = addButton;
	this.editor.xmlState.documentChangedEvent();
	this.editor.resize();
};

// Select element selected and inform the editor state of this change
GUIEditor.prototype.selectElement = function(selected) {
	if (!selected || selected.length == 0) {
		this.deselect();
	} else {
		$("." + xmlElementClass + ".selected").removeClass("selected");
		$('.' + attributeContainerClass + ".selected").removeClass("selected");
		if (selected instanceof XMLElement){
			this.selectedElement = selected;
		} else {
			selected = $(selected);
			this.selectedElement = selected.data("xmlElement");
			selected = this.selectedElement;
		}
		selected.select();
		this.editor.modifyMenu.refreshContextualMenus(selected);
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
	$("." + xmlElementClass + ".selected").removeClass("selected");
	this.selectedElement = null;
	if (this.editor.modifyMenu != null)
		this.editor.modifyMenu.clearContextualMenus();
	return this;
};

// Delete the selected element or attribute
GUIEditor.prototype.deleteSelected = function() {
	if (this.selectedElement == null)
		return this;
	try {
		var selectedAttribute = this.selectedElement.getSelectedAttribute();
	} catch(error) {
		// Attribute container undefined
		var selectedAttribute = [];
		selectedAttribute.length = 0;
	}
	if (selectedAttribute.length > 0) {
		this.selectAttribute(true);
		var newSelection = selectedAttribute.prev('.' + attributeContainerClass);
		if (newSelection.length == 0)
			newSelection = selectedAttribute.next('.' + attributeContainerClass);
		newSelection.addClass("selected");
		
		var xmlAttribute = selectedAttribute.data("xmlAttribute");
		xmlAttribute.remove();
	} else {
		this.deleteElement(this.selectedElement);
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
		var afterDeleteSelection = xmlElement.domNode.next("." + xmlElementClass);
		if (afterDeleteSelection.length == 0)
			afterDeleteSelection = xmlElement.domNode.prev("." + xmlElementClass);
		if (afterDeleteSelection.length == 0)
			afterDeleteSelection = xmlElement.domNode.parents("." + xmlElementClass).first();
		this.selectElement(afterDeleteSelection);
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

// Move the currently selected element by x number of positions
GUIEditor.prototype.moveSelected = function(up) {
	return this.moveElement(this.selectedElement, up);
};

// Move xmlElement by x number of positions
GUIEditor.prototype.moveElement = function(xmlElement, up) {
	if (xmlElement == null)
		return this;
	var result = up? xmlElement.moveUp() : xmlElement.moveDown();
	if (result) {
		this.editor.xmlState.documentChangedEvent();
		xmlElement.focus();
	}
	return this;
};

// Update an elements position in the XML document to reflect its position in the editor
GUIEditor.prototype.updateElementPosition = function(moved) {
	var movedElement = moved.data('xmlElement');
	
	var sibling = moved.prev('.' + xmlElementClass);
	if (sibling.length == 0) {
		sibling = moved.next('.' + xmlElementClass);
		movedElement.xmlNode.detach().insertBefore(sibling.data('xmlElement').xmlNode);
	} else {
		movedElement.xmlNode.detach().insertAfter(sibling.data('xmlElement').xmlNode);
	}
	this.selectElement(moved);
	this.editor.xmlState.documentChangedEvent();
};

// Select the next or previous sibling element of the selected element
GUIEditor.prototype.selectSibling = function(reverse) {
	var direction = reverse? 'prev' : 'next';
	if (this.selectedElement.domNode.length > 0) {
		newSelection = this.selectedElement.domNode[direction]("." + xmlElementClass);
		if (newSelection.length == 0 && !this.selectedElement.isTopLevel) {
			// If there is no next sibling but the parent has one, then go to parents sibling
			this.selectedElement.domNode.parents("." + xmlElementClass).each(function(){
				newSelection = $(this)[direction]("." + xmlElementClass);
				if (newSelection.length > 0 || $(this).data("xmlElement").isTopLevel)
					return false;
			});
		}
	} else {
		if (!reverse)
			newSelection = $("." + xmlElementClass).first();
	}
	
	if (newSelection.length == 0)
		return this;
	this.selectElement(newSelection.first()).selectedElement.focus();
	return this;
};

// Select the parent of the currently selected element
GUIEditor.prototype.selectParent = function(reverse) {
	if (reverse)
		newSelection = this.selectedElement.domNode.find("." + xmlElementClass);
	else newSelection = this.selectedElement.domNode.parents("." + xmlElementClass);
	if (newSelection.length == 0)
		return this;
	this.selectElement(newSelection.first()).selectedElement.focus();
	return this;
};

// Select the next child of the currently selected element.  If it has no children,
// then select the next sibling if any are available.
GUIEditor.prototype.selectNext = function(reverse) {
	var newSelection = null;
	if (this.selectedElement == null) {
		if (!reverse)
			newSelection = $("." + xmlElementClass).first();
	} else {
		var found = false;
		var allElements = $("." + xmlElementClass + ":visible", this.xmlContent);
		
		if (reverse)
			allElements = $(allElements.get().reverse());
		
		var selectedElement = this.selectedElement;
		allElements.each(function(){
			if (found) {
				newSelection = $(this);
				return false;
			} else if (this.id == selectedElement.domNodeID) {
				found = true;
			}
		});
	}
	
	if (newSelection != null)
		this.selectElement(newSelection.first()).selectedElement.focus();
	return this;
};

// Select the previous or next attribute of the selected element
GUIEditor.prototype.selectAttribute = function(reverse) {
	if (this.selectedElement == null) {
		return this;
	} else {
		var selectedAttribute = this.selectedElement.getSelectedAttribute();
		if (selectedAttribute.length > 0) {
			var newSelection = selectedAttribute[reverse? 'prev' : 'next']("." + attributeContainerClass);
			if (newSelection.length > 0) {
				$("." + attributeContainerClass + ".selected").removeClass("selected");
				newSelection.addClass("selected");
			}
		} else {
			if (this.selectedElement.attributeContainer)
				selectedAttribute = this.selectedElement.attributeContainer.children("." + attributeContainerClass)
						.first().addClass("selected");
		}
	}
};

// Find and select the nearest element text field in an element or its children
GUIEditor.prototype.focusSelectedText = function() {
	if (this.selectedElement == null)
		return this;
	var focused = null;
	if (this.selectedElement.textInput != null) {
		focused = this.selectedElement.textInput.focus();
	} else {
		focused = this.selectedElement.domNode.find("input[type=text].element_text:visible, textarea.element_text:visible, select.element_text:visible").first().focus();
	}
	if (focused == null || focused.length == 0)
		return this;
	// If the focused input was in an element other than the selected one, then select it
	var containerElement = focused.parents("." + xmlElementClass);
	if (containerElement !== this.selectedElement)
		this.selectElement(containerElement);
	return this;
};

// Find and focus the nearest input field in the selected element or its children.  If the 
// input field focused belonged to a child, then select that child.
GUIEditor.prototype.focusInput = function(reverse) {
	var focused = $("input:focus, textarea:focus, select:focus");
	if (focused.length == 0 && this.selectedElement == null) {
		if (reverse)
			return this;
		// Nothing is selected or focused, so grab the first available input
		focused = this.xmlContent.find("input[type=text]:visible, textarea:visible, select:visible").first().focus();
	} else {
		// When an input is already focused, tabbing selects the next input
		var foundFocus = false;
		var inputsSelector = "input[type=text]:visible, textarea:visible, select:visible";
		// If no inputs are focused but an element is selected, seek the next input near this element
		if (this.selectedElement != null && focused.length == 0) {
			inputsSelector += ", ." + xmlElementClass;
			focused = this.selectedElement.domNode;
		}
		var visibleInputs = this.xmlContent.find(inputsSelector);
		// If in reverse mode, get the previous input
		if (reverse) {
			visibleInputs = $(visibleInputs.get().reverse());
		}
		// Seek the next input after the focused one
		visibleInputs.each(function(){
			// Can't focus a xml class if they are present.
			if (foundFocus && !$(this).hasClass(xmlElementClass)) {
				focused = $(this).focus();
				return false;
			} else if (this.id == focused.attr('id')) {
				foundFocus = true;
			}
		});
	}
	// If the focused input was in an element other than the selected one, then select it
	var containerElement = focused.parents("." + xmlElementClass);
	if (containerElement !== this.selectedElement)
		this.selectElement(containerElement);
	var container = focused.parents('.' + attributeContainerClass);
	if (container.length > 0)
		container.addClass('selected');
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
