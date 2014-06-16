function AddNodeMenu(menuID, label, expanded, enabled, owner, editor) {
	this.menuID = menuID;
	// Refence to jquery object which contains the menu options
	this.menuContent = null;
	// Indicates if the menu can be interacted with
	this.enabled = enabled;
	this.owner = owner;
	this.editor = editor;
	this.label = label;
	this.expanded = expanded;
}

AddNodeMenu.prototype.constructor = AddNodeMenu;
AddNodeMenu.prototype = Object.create( ModifyElementMenu.prototype );

AddNodeMenu.prototype.destroy = function() {
	if (this.menuContent != null)
		this.menuContent.remove();
};

AddNodeMenu.prototype.initEventHandlers = function() {
	var self = this;
	// Add new child element click event
	this.menuContent.on('click', 'li', function(event){
		var prepend = self.editor.options.prependNewElements;
		if (event.shiftKey) prepend = !prepend;
		self.owner.editor.addTextCallback(this, prepend);
	});

	this.menuContent.on('click', '.xml-add-cdata', function(event){
		var prepend = self.editor.options.prependNewElements;
		if (event.shiftKey) prepend = !prepend;
		self.owner.editor.addCDATACallback(this, prepend);
	});
};

AddNodeMenu.prototype.populate = function(xmlElement) {
	if (!this.editor.guiEditor.active)
		return;

	if (this.expanded)
		this.menuContent.css("height", "auto");
	var startingHeight = this.menuContent.outerHeight();
	this.menuContent.empty();

	$("<li class='xml-add-cdata'>Add CDATA</li>").data('xml', {
		"target": xmlElement
	}).appendTo(this.menuContent);

	if (xmlElement.objectType.type != null) {
		this.addButton = $("<li>Add text</li>").attr({
			title : 'Add text'
		}).data('xml', {
			"target": xmlElement
		}).appendTo(this.menuContent);
	}

	// Add comment button

	// Add arbitrary tag button

	if (xmlElement.objectType.type != "mixed" || !this.editor.guiEditor.active) {
		//this.menuContent.hide();
	}

	if (this.expanded) {
		var endingHeight = this.menuContent.outerHeight();
		if (endingHeight == 0)
			endingHeight = 1;
		this.menuContent.css({height: startingHeight + "px"}).stop().animate({height: endingHeight + "px"}, menuExpandDuration).show();
	}

	if (this.menuContent.children().length == 0) {
		this.menuHeader.addClass("disabled");
		this.enabled = false;
	} else {
		this.menuHeader.removeClass("disabled");
		this.enabled = true;
	}
	
	return this;
};

AddNodeMenu.prototype.clear = function() {
	this.menuContent.hide();
};