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
	$("<span/>").attr('class', submissionStatusClass).html("Document is unchanged").appendTo(this.menuColumn);
	
	var submitButton = $("<input/>").attr({
		'id' : submitButtonClass,
		'type' : 'button',
		'class' : 'send_xml',
		'name' : 'submit',
		'value' : 'Submit Changes'
	}).appendTo(this.menuColumn);
	if (this.editor.options.ajaxOptions.xmlUploadPath == null) {
		if (typeof(Blob) !== undefined){
			submitButton.attr("value", "Export");
		} else {
			submitButton.attr("disabled", "disabled");
		}
	}
	
	this.menuContainer = $("<div class='" + menuContainerClass + "'/>").appendTo(this.menuColumn);
	this.menuContainer.css({'max-height': $(window).height(), 'overflow-y': 'auto'});
	return this;
};

ModifyMenuPanel.prototype.addMenu = function(menuID, label, expanded, enabled, contextual) {
	if (arguments.length == 4)
		contextual = false;
	var menu = new ModifyElementMenu(menuID, label, expanded, enabled, this);
	this.menus[menuID] = {
			"menu" : menu, 
			"contextual": contextual
		};
	menu.render(this.menuContainer);
	menu.initEventHandlers();
	return menu;
};

ModifyMenuPanel.prototype.addAttributeMenu = function(menuID, label, expanded, enabled, contextual) {
	if (arguments.length == 4)
		contextual = false;
	var menu = new AttributeMenu(menuID, label, expanded, enabled, this);
	this.menus[menuID] = {
			"menu" : menu, 
			"contextual": contextual
		};
	menu.render(this.menuContainer);
	menu.initEventHandlers();
	return menu;
};

ModifyMenuPanel.prototype.clearContextualMenus = function() {
	$.each(this.menus, function(){
		if (this.contextual) {
			this.menu.clear();
		}
	});
	this.setMenuPosition();
	return this;
};

ModifyMenuPanel.prototype.refreshContextualMenus = function(targetElement) {
	$.each(this.menus, function(){
		if (this.contextual) {
			this.menu.populate(targetElement);
		}
	});
	this.setMenuPosition();
	return this;
};

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
		this.editor.editorHeader.css({
			position : 'fixed',
			top : 0
		});
	} else {
		this.menuColumn.css({
			position : 'absolute',
			left : xmlEditorContainer.outerWidth() - this.menuColumn.innerWidth(),
			top : 0
		});
		this.editor.editorHeader.css({
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
