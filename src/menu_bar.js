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
		label : self.editor.options.i18n[self.editor.options.userLang].file,
		enabled : true,
		show: true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
				label : self.editor.options.i18n[self.editor.options.userLang].submitChanges,
				enabled : defaultSubmitConfig != null,
				show: self.editor.options.enableEdit,
				binding : self.editor.options.i18n[self.editor.options.userLang].altShiftS,
				action : function() {
					self.editor.uploadXML.call(self.editor, defaultSubmitConfig);
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].export,
				enabled : (typeof(Blob) !== undefined),
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].altShiftE,
				action : $.proxy(self.editor.exportXML, self.editor)
			} ]
	}, {
		label : self.editor.options.i18n[self.editor.options.userLang].edit,
		enabled : self.editor.options.enableEdit, // readonly mode
		show: self.editor.options.enableEdit, // readonly mode
		action : function(event) {self.activateMenu(event);},
		items : [ {
			label : self.editor.options.i18n[self.editor.options.userLang].undoMenuitem,
			enabled : true,
			show: true,
			binding : self.editor.options.i18n[self.editor.options.userLang].undo,
			action : function() {
				self.editor.undoHistory.changeHead(-1);
			}
		}, {
			label : self.editor.options.i18n[self.editor.options.userLang].redoMenuitem,
			enabled : true,
			show: true,
			binding : self.editor.options.i18n[self.editor.options.userLang].redo,
			action : function() {
				self.editor.undoHistory.changeHead(1);
			}
		}, {
			label : self.editor.options.i18n[self.editor.options.userLang].deleteElement,
			enabled : true,
			show: true,
			binding : self.editor.options.i18n[self.editor.options.userLang].del,
			action : function(){
				self.editor.guiEditor.deleteSelected();
			}
		}, {
			label : self.editor.options.i18n[self.editor.options.userLang].moveElementUp,
			enabled : true,
			show: true,
			binding : self.editor.options.i18n[self.editor.options.userLang].elementUp,
			action : function(){
				self.editor.guiEditor.moveSelected(true);
			}
		}, {
			label : self.editor.options.i18n[self.editor.options.userLang].moveElementDown,
			enabled : true,
			show: true,
			binding : self.editor.options.i18n[self.editor.options.userLang].elementDown,
			action : function(){
				self.editor.guiEditor.moveSelected();
			}
		} ]
	}, {
		label : self.editor.options.i18n[self.editor.options.userLang].select,
		enabled : self.editor.options.enableEdit, // readonly mode
		show: self.editor.options.enableEdit, // readonly mode
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
				label : self.editor.options.i18n[self.editor.options.userLang].deselect,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].esc,
				action : function(){
					self.editor.guiEditor.deselect();
				}
			},{
				label : self.editor.options.i18n[self.editor.options.userLang].nextElement,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].down,
				action : function(){
					self.editor.guiEditor.selectNext();
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].previousElement,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].up,
				action : function(){
					self.editor.guiEditor.selectNext(true);
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].nextAttribute,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].right,
				action : function(){
					self.editor.guiEditor.selectAttribute();
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].previousAttribute,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].left,
				action : function(){
					self.editor.guiEditor.selectAttribute(true);
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].parentElement,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].shiftLeft,
				action : function(){
					self.editor.guiEditor.selectParent();
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].firstChild,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].shiftRight,
				action : function(){
					self.editor.guiEditor.selectParent(true);
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].nextSibling,
				enabled : true,
				show: true,	
				binding : self.editor.options.i18n[self.editor.options.userLang].shiftDown,
				action : function(){
					self.editor.guiEditor.selectSibling();
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].previousSibling,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].shiftUp,
				action : function(){
					self.editor.guiEditor.selectSibling(true);
				}
			} ]
	}, {
		label : self.editor.options.i18n[self.editor.options.userLang].insert,
		enabled : true,
		show: self.editor.options.enableEdit,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
				label : self.editor.options.i18n[self.editor.options.userLang].addAttribute,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].altA,
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected instanceof XMLElement)
						self.editor.addNode(selected, "attribute", false);
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].addElement,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].enter,
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected instanceof XMLElement) {
						self.editor.addNextElement(selected, false);
					}
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].addChildElement,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].addE,
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected instanceof XMLElement)
						self.editor.addNode(selected, "element", false);
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].addSiblingElement,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].addS,
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected.parentElement, "element", false, selected);
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].addElementToParent,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].addP,
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected.parentElement, "element", false);
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].addElementToRoot,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].altR,
				action : function(){
					self.editor.addNode(self.editor.guiEditor.rootElement, "element", false);
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].addTextToElement,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].altT,
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected, "text", false);
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].addCommentToElement,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].altSlash,
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected, "comment", false);
				}
			}, {
				label : self.editor.options.i18n[self.editor.options.userLang].addCDataToElement,
				enabled : true,
				show: true,
				binding : self.editor.options.i18n[self.editor.options.userLang].altComma,
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected, "cdata", false);
				}
			} ]
	}, {
		label : self.editor.options.i18n[self.editor.options.userLang].view,
		enabled : true,
		show: true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
			label : self.editor.options.i18n[self.editor.options.userLang].switchToXml,
			enabled : true,
			binding : self.editor.options.i18n[self.editor.options.userLang].altShiftX,
			action : function() {
				self.editor.modeChange(0);
			}
		}, {
			label :  self.editor.options.i18n[self.editor.options.userLang].switchToText,
			enabled : true,
			binding : self.editor.options.i18n[self.editor.options.userLang].altShiftT,
			action : function() {
				self.editor.modeChange(1);
			}
		} ]
	}, {
		label : self.editor.options.i18n[self.editor.options.userLang].options,
		enabled : true,
		show: true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
			label : self.editor.options.i18n[self.editor.options.userLang].prettifyXml,
			enabled : true,
			show: true,
			checked : self.editor.options.prettyXML,
			action : function() {
				self.editor.options.prettyXML = !self.editor.options.prettyXML;
				self.checkEntry(this, self.editor.options.prettyXML);
			}
		}, {
			label : self.editor.options.i18n[self.editor.options.userLang].enableShortcuts,
			enabled : true,
			show: true,
			checked : self.editor.options.enableGUIKeybindings,
			action : function() {
				self.editor.setEnableKeybindings(!self.editor.options.enableGUIKeybindings);
				self.checkEntry(this, self.editor.options.enableGUIKeybindings);
			}
		}, {
			label : self.editor.options.i18n[self.editor.options.userLang].enforceMinMaxOccurs,
			enabled : self.editor.options.enforceOccurs,
			show: true,
			checked : self.editor.options.enforceOccurs,
			action : function() {
				self.editor.options.enforceOccurs = !self.editor.options.enforceOccurs;
				self.editor.modifyMenu.refreshContextualMenus();
				self.checkEntry(this, self.editor.options.enforceOccurs);
			}
		}, {
			label : self.editor.options.i18n[self.editor.options.userLang].prependNewElements,
			enabled : true,
			show: true,
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
		label : self.editor.options.i18n[self.editor.options.userLang].xml,
		enabled : true, 
		show: true,
		itemClass : 'header_mode_tab',
		action : function() {
			self.editor.modeChange(0);
		}
	}, {
		label : self.editor.options.i18n[self.editor.options.userLang].text,
		enabled : true, 
		show: true,
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
	if (this.editor.options.sourceDesignSwitch) {// Enable hiding the XML/Source switch buttons
		this.menuBarContainer = $("<div/>").addClass(xmlMenuBarClass).appendTo(parentElement);
	
		this.headerMenu = $("<ul/>");
		this.menuBarContainer.append(this.headerMenu);
		this.initEventHandlers();
	
		var menuBar = this;
		$.each(this.headerMenuData, function() {
			if (this.show) { // Enable hiding unwanted menus
				menuBar.generateMenuItem(this, menuBar.headerMenu);
			}
		});
	}
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
