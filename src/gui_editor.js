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
	$("<div/>").attr("class", "placeholder").html("There are no elements in this document.  Use the menu on the right to add new top level elements.")
			.appendTo(this.xmlContent);
	
	this.guiContent = $("<div/>").attr({'id' : guiContentClass + this.editor.instanceNumber, 'class' : guiContentClass}).appendTo(parentContainer);
	//this.guiContent = parentContainer;
	
	this.guiContent.append(this.xmlContent);
	
	this.rootElement = new XMLElement(this.editor.xmlState.xml.children().first(), this.editor.schema, this.editor);
	this.rootElement.guiElement = this.xmlContent;
	this.rootElement.guiElement.data("xmlElement", this.rootElement);
	this.rootElement.childContainer = this.xmlContent;
	this.rootElement.initializeGUI();
	
	this._initEventBindings();
	return this;
};

GUIEditor.prototype._initEventBindings = function() {
	var self = this;
	// Attributes
	this.xmlContent.on('click', '.' + attributeContainerClass, function(event){
		$(this).data('xmlAttribute').select();
		event.stopPropagation();
	}).on('click', '.' + attributeContainerClass + " > a", function(event){
		$(this).parents('.' + attributeContainerClass).eq(0).data('xmlAttribute').remove();
		event.stopPropagation();
	}).on('change', '.' + attributeContainerClass + ' > input,.' + attributeContainerClass + ' > textarea', function(event){
		$(this).parents('.' + attributeContainerClass).eq(0).data('xmlAttribute').syncValue();
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
	});
};

GUIEditor.prototype.activate = function() {
	this.guiContent.show();
	this.active = true;
	this.deselect();
	
	this.editor.textEditor.resetSelectedTagRange();
	if (this.editor.textEditor.isModified() || (this.editor.textEditor.isInitialized() && this.editor.xmlState.isChanged())) {
		this.editor.refreshDisplay();
		this.editor.textEditor.setInitialized();
	}
	
	return this;
};

GUIEditor.prototype.deactivate = function() {
	this.active = false;
	this.guiContent.hide();
	return this;
};

GUIEditor.prototype.nextIndex = function() {
	return xmlElementClass + (++this.elementIndex);
};

GUIEditor.prototype.clearElements = function() {
	$("." + topLevelContainerClass).remove();
	return this;
};

GUIEditor.prototype.resize = function() {
	//xmlContent.width(guiContent.width() - menuContainer.width() - 30);
	return this;
};

GUIEditor.prototype.refreshDisplay = function() {
	this.deselect();
	this.elementIndex = 0;
	this.rootElement.xmlNode = this.editor.xmlState.xml.children().first();
	this.refreshElements();
	return this;
};

GUIEditor.prototype.refreshElements = function() {
	this.rootElement.renderChildren(true);
	return this;
};

GUIEditor.prototype.addElementEvent = function(parentElement, newElement) {
	if (parentElement.guiElementID != this.xmlContent.attr("id")) {
		parentElement.updated();
	}
	this.focusObject(newElement.guiElement);
	this.selectElement(newElement);
	
	this.editor.xmlState.documentChangedEvent();
};

GUIEditor.prototype.addAttributeEvent = function(parentElement, objectType, addButton) {
	var attribute = new XMLAttribute(objectType, parentElement, this.editor);
	attribute.render();
	parentElement.updated();
	this.focusObject(attribute.attributeContainer);
	addButton.addClass("disabled");
	attribute.addButton = addButton;
	this.editor.xmlState.documentChangedEvent();
};

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

GUIEditor.prototype.deleteSelected = function() {
	if (this.selectedElement == null)
		return this;
	var selectedAttribute = this.selectedElement.getSelectedAttribute();
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

GUIEditor.prototype.deleteElement = function(xmlElement) {
	var isSelected = xmlElement.isSelected();
	if (isSelected) {
		var afterDeleteSelection = xmlElement.guiElement.next("." + xmlElementClass);
		if (afterDeleteSelection.length == 0)
			afterDeleteSelection = xmlElement.guiElement.prev("." + xmlElementClass);
		if (afterDeleteSelection.length == 0)
			afterDeleteSelection = xmlElement.guiElement.parents("." + xmlElementClass).first();
		this.selectElement(afterDeleteSelection);
	}
	xmlElement.remove();
	this.editor.xmlState.documentChangedEvent();
	return this;
};

GUIEditor.prototype.moveSelected = function(up) {
	return this.moveElement(this.selectedElement, up);
};

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

GUIEditor.prototype.selectSibling = function(reverse) {
	var direction = reverse? 'prev' : 'next';
	if (this.selectedElement.guiElement.length > 0) {
		newSelection = this.selectedElement.guiElement[direction]("." + xmlElementClass);
		if (newSelection.length == 0 && !this.selectedElement.isTopLevel) {
			// If there is no next sibling but the parent has one, then go to parents sibling
			this.selectedElement.guiElement.parents("." + xmlElementClass).each(function(){
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

GUIEditor.prototype.selectParent = function(reverse) {
	if (reverse)
		newSelection = this.selectedElement.guiElement.find("." + xmlElementClass);
	else newSelection = this.selectedElement.guiElement.parents("." + xmlElementClass);
	if (newSelection.length == 0)
		return this;
	this.selectElement(newSelection.first()).selectedElement.focus();
	return this;
};

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
			} else if (this.id == selectedElement.guiElementID) {
				found = true;
			}
		});
	}
	
	if (newSelection != null)
		this.selectElement(newSelection.first()).selectedElement.focus();
	return this;
};

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
			selectedAttribute = this.selectedElement.attributeContainer.children("." + attributeContainerClass)
					.first().addClass("selected");
		}
	}
};

GUIEditor.prototype.focusSelectedText = function() {
	if (this.selectedElement == null)
		return this;
	var focused = null;
	if (this.selectedElement.textInput != null) {
		focused = this.selectedElement.textInput.focus();
	} else {
		focused = this.selectedElement.guiElement.find("input[type=text].element_text:visible, textarea.element_text:visible, select.element_text:visible").first().focus();
	}
	if (focused == null || focused.length == 0)
		return this;
	// If the focused input was in an element other than the selected one, then select it
	var containerElement = focused.parents("." + xmlElementClass);
	if (containerElement !== this.selectedElement)
		this.selectElement(containerElement);
	return this;
};

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
			focused = this.selectedElement.guiElement;
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

GUIEditor.prototype.isCompletelyOnScreen = function(object) {
	var objectTop = object.offset().top;
	var objectBottom = objectTop + object.height();
	var docViewTop = $(window).scrollTop() + this.editor.editorHeader.height();
    var docViewBottom = docViewTop + $(window).height() - this.editor.editorHeader.height();
    
    return (docViewTop < objectTop) && (docViewBottom > objectBottom);
};

GUIEditor.prototype.focusObject = function(focusTarget) {
	if (!this.isCompletelyOnScreen(focusTarget)){
		var scrollHeight = focusTarget.offset().top + (focusTarget.height()/2) - ($(window).height()/2);
		if (scrollHeight > focusTarget.offset().top)
			scrollHeight = focusTarget.offset().top;
		scrollHeight -= this.editor.editorHeader.height();
		$("html, body").stop().animate({ scrollTop: scrollHeight }, 500);
	}
};
