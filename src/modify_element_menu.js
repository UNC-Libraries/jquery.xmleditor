/**
 * Menu object for adding new elements to an existing element or document
 * @param menuID
 * @param label
 * @param expanded
 * @param enabled
 * @returns
 */
function ModifyElementMenu(menuID, label, expanded, enabled, owner, editor, getRelativeToFunction) {
	this.menuID = menuID;
	this.label = label;
	// Header jquery element for this menu 
	this.menuHeader = null;
	// Refence to jquery object which contains the menu options
	this.menuContent = null;
	// Indicates if the menu can be interacted with
	this.enabled = enabled;
	// Indicates if the menu is collapsed or expanded
	this.expanded = expanded;
	// Optional function which determines what element to position newly added elements relative to
	this.getRelativeToFunction = getRelativeToFunction;
	// XMLElement object which will be modified by this menu
	this.target = null;
	this.owner = owner;
	this.editor = editor;
}

ModifyElementMenu.prototype.destroy = function() {
	if (this.menuHeader != null)
		this.menuHeader.remove();
	if (this.menuContent != null)
		this.menuContent.remove();
};

// Creates the structure for the menu, including headers and content areas.
ModifyElementMenu.prototype.render = function(parentContainer) {
	this.menuHeader = $("<div class='" + menuHeaderClass + "'/>").appendTo(parentContainer);
	if (this.expanded) {
		this.menuHeader.html(this.label + " <span>&#9660;</span>");
	} else {
		this.menuHeader.html(this.label + " <span>&#9654;</span>");
	}
	
	if (!this.enabled)
		this.menuHeader.addClass("disabled");
	
	this.menuContent = $("<ul id='" + this.menuID + "' class='" + menuContentClass + "'/>").data('menuData', this).appendTo(parentContainer);
	var self = this;
	// Click handler for hiding/show the contents of the menu
	this.menuHeader.click(function(){
		if (!self.enabled) 
			return;
		if (self.expanded) {
			self.menuContent.animate({height: 'hide'}, menuExpandDuration, null, function(){
				self.menuContent.hide();
			});
			self.menuHeader.html(self.label + " <span>&#9654;</span>");
			self.expanded = false;
		} else {
			self.menuContent.show();
			self.menuContent.animate({height: 'show'}, menuExpandDuration);
			self.menuHeader.html(self.label + " <span>&#9660;</span>");
			self.expanded = true;
		}
	});
	return this;
};

ModifyElementMenu.prototype.initEventHandlers = function() {
	var self = this;
	// Add new child element click event
	this.menuContent.on('click', 'li', function(event){
		var relativeTo = (self.getRelativeToFunction)? 
				self.getRelativeToFunction($(this).data("xml").target) : null;
		var prepend = self.editor.options.prependNewElements;
		if (event.shiftKey) prepend = !prepend;
		self.owner.editor.addChildElementCallback(this, relativeTo, prepend);
	});
};

// Empty out the menu and collapse it
ModifyElementMenu.prototype.clear = function() {
	var startingHeight = this.menuContent.height();
	this.menuContent.empty();
	this.menuContent.css({height: startingHeight + "px"}).stop().animate({height: "0px"}, menuExpandDuration);
	this.target = null;
	this.enabled = false;
	this.menuHeader.addClass('disabled');
	return this;
};

// Populate the menu with entries for adding child elements of from the definition of the given XMLElement 
ModifyElementMenu.prototype.populate = function(xmlElement) {
	if (xmlElement == null || (this.target != null && xmlElement.domNode != null 
			&& this.target[0] === xmlElement.domNode[0]))
		return;
	
	if (this.expanded)
		this.menuContent.css("height", "auto");
	// Store the current height of the menu for use animating the height changes
	var startingHeight = this.menuContent.outerHeight();
	// Clear the previous menu contents
	this.menuContent.empty();
	
	// Store new target element for this menu
	this.target = xmlElement;
	var self = this;
	var parent = this.target;
	var choiceList = parent.objectType.choices;
	
	// Iterate through the child element definitions and generate entries for each
	$.each(this.target.objectType.elements, function(){
		var xmlElement = this;
		var elName = self.editor.xmlState.namespaces.getNamespacePrefix(xmlElement.namespace) + xmlElement.localName;
		var addButton = $("<li/>").attr({
			title : 'Add ' + elName
		}).html(elName)
		.data('xml', {
				"target": self.target,
				"objectType": xmlElement
		}).appendTo(self.menuContent);
		// Disable the entry if its parent won't allow any more of this element type.
		if (!parent.childCanBeAdded(xmlElement))
			addButton.addClass('disabled');
	});
	if (this.expanded) {
		var endingHeight = this.menuContent.outerHeight() + 1;
		if (endingHeight == 0)
			endingHeight = 1;
		this.menuContent.css({height: startingHeight + "px"}).stop().animate({height: endingHeight + "px"}, menuExpandDuration).show();
	}

	// Disable or enable the menu depending on if it had any options added to it
	if (this.menuContent.children().length == 0) {
		this.menuHeader.addClass("disabled");
		this.enabled = false;
	} else {
		this.menuHeader.removeClass("disabled");
		this.enabled = true;
	}
	return this;
};
