/**
 * Header bar with dropdown menus.  In addition to the default menu options, user provided
 * menus or options may be added as well.  Supports refreshing of menu items states via externally
 * defined updateFunctions
 */
function MenuBar(editor) {
	this.editor = editor;
	this.menuBarContainer = null;
	this.parentElement = null;
	// Functions which are executed when the menu is activated for updating the menu state
	this.updateFunctions = [];
	
	var self = this;
	// Default menu entries
	this.headerMenuData = [ {
		label : 'File',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
				label : 'Submit to Server',
				enabled : (self.editor.options.ajaxOptions.xmlUploadPath != null),
				binding : "alt+shift+s",
				action : $.proxy(self.editor.submitXML, self.editor)
			}, {
				label : 'Export',
				enabled : (typeof(Blob) !== undefined),
				binding : "alt+shift+e",
				action : $.proxy(self.editor.exportXML, self.editor)
			} ]
	}, {
		label : 'Edit',
		enabled : true,
		action : function(event) {self.activateMenu(event);},
		items : [ {
			label : 'Undo',
			enabled : false,
			binding : "ctrl+z or mac+z",
			action : function() {
				self.editor.undoHistory.changeHead(-1);
			}
		}, {
			label : 'Redo',
			enabled : false,
			binding : "ctrl+y or mac+shift+z",
			action : function() {
				self.editor.undoHistory.changeHead(1);
			}
		}, {
			label : 'Delete',
			enabled : true,
			binding : "del",
			action : function(){
				self.editor.guiEditor.deleteSelected();
			}
		}, {
			label : 'Move Element Up',
			enabled : true,
			binding : "alt+up",
			action : function(){
				self.editor.guiEditor.moveSelected(true);
			}
		}, {
			label : 'Move Element Down',
			enabled : true,
			binding : "alt+down",
			action : function(){
				self.editor.guiEditor.moveSelected();
			}
		} ]
	}, {
		label : 'Select',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
				label : 'Deselect',
				enabled : true,
				binding : "esc",
				action : function(){
					self.editor.guiEditor.deselect();
				}
			},{
				label : 'Next Element',
				enabled : true,
				binding : "down",
				action : function(){
					self.editor.guiEditor.selectNext();
				}
			}, {
				label : 'Previous Element',
				enabled : true,
				binding : "up",
				action : function(){
					self.editor.guiEditor.selectNext(true);
				}
			}, {
				label : 'Next Attribute',
				enabled : true,
				binding : "right",
				action : function(){
					self.editor.guiEditor.selectAttribute();
				}
			}, {
				label : 'Previous Attribute',
				enabled : true,
				binding : "left",
				action : function(){
					self.editor.guiEditor.selectAttribute(true);
				}
			}, {
				label : 'Parent',
				enabled : true,
				binding : "shift+left",
				action : function(){
					self.editor.guiEditor.selectParent();
				}
			}, {
				label : 'First Child',
				enabled : true,
				binding : "shift+right",
				action : function(){
					self.editor.guiEditor.selectParent(true);
				}
			}, {
				label : 'Next Sibling',
				enabled : true,
				binding : "shift+down",
				action : function(){
					self.editor.guiEditor.selectSibling();
				}
			}, {
				label : 'Previous Sibling',
				enabled : true,
				binding : "shift+up",
				action : function(){
					self.editor.guiEditor.selectSibling(true);
				}
			} ]
	}, {
		label : 'View',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
			label : 'Switch to XML View',
			enabled : true,
			binding : "alt+shift+x",
			action : function() {
				self.editor.modeChange(0);
			}
		}, {
			label : 'Switch to Text View',
			enabled : true,
			binding : "alt+shift+t",
			action : function() {
				self.editor.modeChange(1);
			}
		} ]
	}, {
		label : 'Help',
		enabled : true,
		action : function(event) {self.activateMenu(event);}/*, 
		items : [ {
			label : 'MODS Outline of Elements',
			enabled : true,
			binding : null,
			action : "http://www.loc.gov/standards/mods/mods-outline.html"
		} ]*/
	}, {
		label : 'XML',
		enabled : true, 
		itemClass : 'header_mode_tab',
		action : function() {
			self.editor.modeChange(0);
		}
	}, {
		label : 'Text',
		enabled : true, 
		itemClass : 'header_mode_tab',
		action : function() {
			self.editor.modeChange(1);
		}
	} ];
}

// Causes the targeted menu to be displayed, as well as triggering update functions
MenuBar.prototype.activateMenu = function(event) {
	if (this.menuBarContainer.hasClass("active")) {
		this.menuBarContainer.removeClass("active");
		return;
	}
	var self = this;
	$.each(this.updateFunctions, function() {
		this(self.editor);
	});
	this.menuBarContainer.addClass("active");
	this.menuBarContainer.children("ul").children("li").click(function (event) {
		event.stopPropagation();
	});
	$('html').one("click" ,function() {
		self.menuBarContainer.removeClass("active");
	});
	event.stopPropagation();
};

// Builds the menu and attaches it to the editor
MenuBar.prototype.render = function(parentElement) {
	this.parentElement = parentElement;
	this.menuBarContainer = $("<div/>").attr('class', xmlMenuBarClass).appendTo(parentElement);
	
	this.headerMenu = $("<ul/>");
	this.menuBarContainer.append(this.headerMenu);
	
	var menuBar = this;
	$.each(this.headerMenuData, function() {
		menuBar.generateMenuItem(this, menuBar.headerMenu);
	});
};

// Generates an individual menu entry
MenuBar.prototype.generateMenuItem = function(menuItemData, parentMenu) {
	var menuItem = $("<li/>").appendTo(parentMenu);
	var menuItemLink = $("<a/>").appendTo(menuItem).html("<span>" + menuItemData.label + "</span>");
	if (menuItemData.binding) {
		menuItemLink.append("<span class='binding'>" + menuItemData.binding + "</span>");
	}
	if (menuItemData.action != null) {
		if (Object.prototype.toString.call(menuItemData.action) == '[object Function]'){
			menuItem.click(menuItemData.action);
		} else {
			menuItemLink.attr({"href": menuItemData.action, "target" : "_blank"});
		}
	}
	if (!menuItemData.enabled) {
		menuItem.addClass("disabled");
	}
	if (menuItemData.itemClass) {
		menuItem.addClass(menuItemData.itemClass);
	}
	
	var menuBar = this;
	menuItem.data("menuItemData", menuItemData).attr("id", xmlMenuHeaderPrefix + menuItemData.label.replace(/ /g, "_"));
	if (menuItemData.items !== undefined && menuItemData.items.length > 0) {
		var subMenu = $("<ul/>").addClass('sub_menu').appendTo(menuItem);
		$.each(menuItemData.items, function() {
			menuBar.generateMenuItem(this, subMenu);
		});
	}
};

// Adds an additional menu entry to the menu.  An insertion path must be included in the entry
// if you wish to add to an existing menu, where the path is the label of the menu to add to
MenuBar.prototype.addEntry = function(entry) {
	var currentTier = this.headerMenuData;
	if (entry.insertPath) {
		$.each(entry.insertPath, function() {
			var pathLabel = this;
			$.each(currentTier, function() {
				if (this.label == pathLabel) {
					currentTier = this.items;
					return false;
				}
			});
		});
	}
	if (currentTier) {
		delete entry.insertPath;
		currentTier.push(entry);
	}
};
