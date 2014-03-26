/**
 * Menu panel for managing individual modification menus.
 */
function ModifyMenuPanel(editor) {
	this.editor = editor;
	this.menus = {};
	this.menuColumn = null;
	this.menuContainer = null;
	
}

ModifyMenuPanel.prototype.initialize = function (parentContainer) {
	this.menuColumn = $("<div/>").attr('class', menuColumnClass).appendTo(parentContainer);
	
	// Generate the document status panel, which shows a save/export button as well as if there are changes to the document
	if (this.editor.options.enableDocumentStatusPanel) {
		var documentStatusPanel = $("<div>");
		$("<span/>").addClass(submissionStatusClass).html("Document is unchanged")
			.appendTo(documentStatusPanel);
		var submitButton = $("<input/>").attr({
			'id' : submitButtonClass,
			'type' : 'button',
			'class' : 'send_xml',
			'name' : 'submit',
			'value' : 'Submit Changes'
		}).appendTo(documentStatusPanel);
		if (this.editor.options.ajaxOptions.xmlUploadPath == null) {
			if (typeof(Blob) !== undefined){
				submitButton.attr("value", "Export");
			} else {
				submitButton.attr("disabled", "disabled");
			}
		}
		documentStatusPanel.appendTo(this.menuColumn);
	}
	
	this.menuContainer = $("<div class='" + menuContainerClass + "'/>").appendTo(this.menuColumn);
	this.menuContainer.css({'max-height': $(window).height(), 'overflow-y': 'auto'});
	return this;
};

// Add an additional menu for adding new elements to the panel
// menuID - id attribute for the menu
// label - display name for the menu
// expanded - whether to show the contents of the menu by default
// enabled - boolean indicating the menu can be interacted with
// contextual - Boolean indicating if this menu needs to be updated when selection changes
ModifyMenuPanel.prototype.addMenu = function(menuID, label, expanded, enabled, contextual,
		getRelativeToFunction) {
	var menu = new ModifyElementMenu(menuID, label, expanded, enabled, this, this.editor, getRelativeToFunction);
	this.menus[menuID] = {
			"menu" : menu, 
			"contextual": contextual
		};
	menu.render(this.menuContainer);
	menu.initEventHandlers();
	return menu;
};

// Add a menu for adding new attributes
ModifyMenuPanel.prototype.addAttributeMenu = function(menuID, label, expanded, enabled, contextual) {
	if (arguments.length == 4)
		contextual = false;
	var menu = new AttributeMenu(menuID, label, expanded, enabled, this, this.editor);
	this.menus[menuID] = {
			"menu" : menu, 
			"contextual": contextual
		};
	menu.render(this.menuContainer);
	menu.initEventHandlers();
	return menu;
};

// Empty entries from all contextual menus
ModifyMenuPanel.prototype.clearContextualMenus = function() {
	$.each(this.menus, function(){
		if (this.contextual) {
			this.menu.clear();
		}
	});
	this.setMenuPosition();
	return this;
};

// Refresh entries for all contextual menus
ModifyMenuPanel.prototype.refreshContextualMenus = function(targetElement) {
	if (targetElement === undefined) {
		if (!this.targetElement)
			return this;
		targetElement = this.targetElement;
	} else this.targetElement = targetElement;
	$.each(this.menus, function(){
		if (this.contextual) {
			this.menu.populate(targetElement);
		}
	});
	this.setMenuPosition();
	return this;
};

// Update the position of the menu
ModifyMenuPanel.prototype.setMenuPosition = function(){
	if (this.menuColumn == null || this.menuColumn.offset() == null)
		return;
	
	var xmlWorkAreaContainer = this.editor.xmlWorkAreaContainer;
	var xmlEditorContainer = this.editor.xmlEditorContainer;
	var menuTop = xmlWorkAreaContainer.offset().top;
	if ($(window).scrollTop() >= menuTop) {
		this.menuColumn.css({
			position : 'fixed',
			left : xmlEditorContainer.offset().left + xmlEditorContainer.outerWidth() - this.menuColumn.innerWidth(),
			top : 0
		});
		this.editor.editorHeaderGroup.css({
			position : 'fixed',
			top : 0
		});
	} else {
		this.menuColumn.css({
			position : 'absolute',
			left : xmlEditorContainer.outerWidth() - this.menuColumn.innerWidth(),
			top : 0
		});
		this.editor.editorHeaderGroup.css({
			position : 'absolute',
			top : 0
		});
	}
	
	// Adjust the menu's height so that it doesn't run out of the editor container
	
	// Gap between the top of the column and the beginning of the actual menu
	var menuOffset = this.menuContainer.offset().top - this.menuColumn.offset().top;
	// Default height matches the height of the work area
	var menuHeight = xmlWorkAreaContainer.height() - menuOffset;
	
	var workAreaOffset = this.menuColumn.offset().top - $(window).scrollTop();
	if (workAreaOffset < 0)
		workAreaOffset = 0;
	// Prevent menu from exceeding window height
	if (menuHeight + menuOffset > $(window).height()) {
		menuHeight = $(window).height() - menuOffset;
	}
	
	// Prevent menu from exceeding editor height
	if (menuHeight + menuOffset > xmlWorkAreaContainer.height() + xmlWorkAreaContainer.offset().top - $(window).scrollTop()) {
		menuHeight = xmlWorkAreaContainer.height() + xmlWorkAreaContainer.offset().top - $(window).scrollTop() - menuOffset;
	}
	this.menuContainer.css({'max-height': menuHeight});
	return this;
};
