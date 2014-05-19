function AddTextMenu(menuID, enabled, owner, editor) {
	this.menuID = menuID;
	// Refence to jquery object which contains the menu options
	this.menuContent = null;
	// Indicates if the menu can be interacted with
	this.enabled = enabled;
	this.owner = owner;
	this.editor = editor;
}

AddTextMenu.prototype.destroy = function() {
	if (this.menuContent != null)
		this.menuContent.remove();
};

// Creates the structure for the menu, including headers and content areas.
AddTextMenu.prototype.render = function(parentContainer) {
	this.menuContent = $("<ul id='" + this.menuID + "' class='" + menuContentClass + "'/>")
		.data('menuData', this).appendTo(parentContainer);
	
	this.addButton = $("<li>Add text</li>").attr({
		title : 'Add text'
	}).appendTo(this.menuContent);
};

AddTextMenu.prototype.initEventHandlers = function() {
	var self = this;
	// Add new child element click event
	this.menuContent.on('click', 'li', function(event){
		var prepend = self.editor.options.prependNewElements;
		if (event.shiftKey) prepend = !prepend;
		self.owner.editor.addTextCallback(this, prepend);
	});
};

AddTextMenu.prototype.populate = function(xmlElement) {
	if (xmlElement.objectType.type != "mixed" || !this.editor.guiEditor.active) {
		this.menuContent.hide();
		return;
	}
	
	this.addButton.data('xml', {
		"target": this.xmlElement
	});
	
	this.menuContent.show();
	
	return this;
};

AddTextMenu.prototype.clear = function() {
	this.menuContent.hide();
};