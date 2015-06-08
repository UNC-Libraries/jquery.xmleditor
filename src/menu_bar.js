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
	var defaultSubmitConfig = null;
	$.each(self.editor.submitButtonConfigs, function(index, config) {
		if (config.url) {
			defaultSubmitConfig = config;
			return false;
		}
	});

	// Default menu entries
	this.headerMenuData = [ {
		label : 'File',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
				label : 'Submit to Server',
				enabled : defaultSubmitConfig != null,
				binding : "ctrl+alt+s",
				action : function() {
					self.editor.uploadXML.call(self.editor, defaultSubmitConfig);
				}
			}, {
				label : 'Export',
				enabled : (typeof(Blob) !== undefined),
				binding : "ctrl+alt+e",
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
		label : 'Insert',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
				label : 'Add child element',
				enabled : true,
				binding : "alt+e",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected instanceof XMLElement)
						self.editor.addNode(selected, "element", false);
				}
			},{
				label : 'Add sibling element',
				enabled : true,
				binding : "alt+s",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected.parentElement, "element", false, selected);
				}
			}, {
				label : 'Add element to parent',
				enabled : true,
				binding : "alt+p",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected.parentElement, "element", false);
				}
			}, {
				label : 'Add element to root',
				enabled : true,
				binding : "alt+r",
				action : function(){
					self.editor.addNode(self.editor.guiEditor.rootElement, "element", false);
				}
			}, {
				label : 'Add text to element',
				enabled : true,
				binding : "alt+t",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected, "text", false);
				}
			}, {
				label : 'Add comment to element',
				enabled : true,
				binding : "alt+/",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected, "comment", false);
				}
			}, {
				label : 'Add CDATA to element',
				enabled : true,
				binding : "alt+,",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected, "cdata", false);
				}
			} ]
	}, {
		label : 'View',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
			label : 'Switch to XML View',
			enabled : true,
			binding : "ctrl+alt+1",
			action : function() {
				self.editor.modeChange(0);
			}
		}, {
			label : 'Switch to Text View',
			enabled : true,
			binding : "ctrl+alt+2",
			action : function() {
				self.editor.modeChange(1);
			}
		} ]
	}, {
		label : 'Options',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
			label : 'Pretty XML Formatting',
			enabled : true,
			checked : self.editor.options.prettyXML,
			action : function() {
				self.editor.options.prettyXML = !self.editor.options.prettyXML;
				self.checkEntry(this, self.editor.options.prettyXML);
			}
		}, {
			label : 'Enable shortcut keys',
			enabled : true,
			checked : self.editor.options.enableGUIKeybindings,
			action : function() {
				self.editor.setEnableKeybindings(!self.editor.options.enableGUIKeybindings);
				self.checkEntry(this, self.editor.options.enableGUIKeybindings);
			}
		}, {
			label : 'Enforce min/max occurs',
			enabled : self.editor.options.enforceOccurs,
			checked : self.editor.options.enforceOccurs,
			action : function() {
				self.editor.options.enforceOccurs = !self.editor.options.enforceOccurs;
				self.editor.modifyMenu.refreshContextualMenus();
				self.checkEntry(this, self.editor.options.enforceOccurs);
			}
		}, {
			label : 'Prepend new elements',
			enabled : true,
			checked : self.editor.options.prependNewElements,
			action : function() {
				self.editor.options.prependNewElements = !self.editor.options.prependNewElements;
				self.checkEntry(this, self.editor.options.prependNewElements);
			}
		} ]
	}/*, {
		label : 'Help',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
			label : 'MODS Outline of Elements',
			enabled : true,
			binding : null,
			action : "http://www.loc.gov/standards/mods/mods-outline.html"
		} ]
	}*/, {
		label : self.editor.options.xmlEditorLabel,
		enabled : true, 
		itemClass : 'header_mode_tab',
		action : function() {
			self.editor.modeChange(0);
		}
	}, {
		label : self.editor.options.textEditorLabel,
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
	$('html').one("click" ,function() {
		self.menuBarContainer.removeClass("active");
	});
	event.stopPropagation();
};

// Builds the menu and attaches it to the editor
MenuBar.prototype.render = function(parentElement) {
	this.parentElement = parentElement;
	this.menuBarContainer = $("<div/>").addClass(xmlMenuBarClass).appendTo(parentElement);
	
	this.headerMenu = $("<ul/>");
	this.menuBarContainer.append(this.headerMenu);
	this.initEventHandlers();
	
	var menuBar = this;
	$.each(this.headerMenuData, function() {
		menuBar.generateMenuItem(this, menuBar.headerMenu);
	});
};

MenuBar.prototype.initEventHandlers = function() {
	this.headerMenu.on("click", "li", { "menuBar" : this}, function(event) {
		var menuItem = $(this).data("menuItemData");
		if (menuItem.enabled && Object.prototype.toString.call(menuItem.action) == '[object Function]'){
			menuItem.action.call(this, event);
		}
	});
};

// Generates an individual menu entry
MenuBar.prototype.generateMenuItem = function(menuItemData, parentMenu) {
	var menuItem = $("<li/>").appendTo(parentMenu);
	var checkArea = $("<span/>").addClass("xml_menu_check").appendTo(menuItem);
		
	var menuItemLink = $("<a/>").appendTo(menuItem).html("<span>" + menuItemData.label + "</span>");
	if (menuItemData.binding) {
		menuItemLink.append("<span class='binding'>" + menuItemData.binding + "</span>");
	}
	// Entries with string actions are treated as hrefs
	if (menuItemData.action != null && Object.prototype.toString.call(menuItemData.action) != '[object Function]'){
		menuItemLink.attr({"href": menuItemData.action, "target" : "_blank"});
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
	
	if (menuItemData.checked)
		this.checkEntry(menuItem, true);
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


MenuBar.prototype.checkEntry = function(menuItem, checked) {
	var menuItem = $(menuItem);
	var menuItemData = menuItem.data("menuItemData");
	menuItemData.checked = checked;
	if (checked) {
		menuItem.find(".xml_menu_check").html("&#x2713;");
	} else {
		menuItem.find(".xml_menu_check").html("");
	}
};